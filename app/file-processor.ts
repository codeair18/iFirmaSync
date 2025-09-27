// file-processor.ts
import fs from 'fs-extra';
import path from 'path';
import { pdfToText } from 'pdf-ts';
import * as xlsx from 'xlsx';
import cryptoUtils from 'crypto';
// @ts-ignore
import GoogleDriveClient from './google-drive-client';
import iFirmaAPIClass from './ifirma-api';
// @ts-ignore
import fileConfig from './config';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
}

interface InvoiceItem {
    StawkaVat: number;
    Nazwa: string;
    Ilosc: number;
    Cena: number;
}

interface InvoiceData {
    identifier: string;
    issueDate?: string;
    saleDate?: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    items: InvoiceItem[];
    source?: string;
    sourceFileId?: string;
    sourceFileName?: string;
    uploadDate?: string;
}

interface ProcessResult {
    success: boolean;
    error?: string;
    data?: any;
}

class FileProcessor {
    private driveClient: any;
    private api: any;
    private processedFiles: Set<string>;

    constructor() {
        this.driveClient = new GoogleDriveClient();
        this.api = new iFirmaAPIClass();
        this.processedFiles = this.loadProcessedFiles();
    }

    async initialize() {
        return await this.driveClient.initialize();
    }

    loadProcessedFiles(): Set<string> {
        try {
            if (fs.existsSync(fileConfig.processedFiles)) {
                const data = fs.readFileSync(fileConfig.processedFiles, 'utf8');
                return new Set(JSON.parse(data));
            }
        } catch (error: any) {
            console.log('Tworzenie nowego pliku processed_files.json');
        }
        return new Set();
    }

    saveProcessedFiles(): void {
        try {
            fs.writeFileSync(fileConfig.processedFiles, JSON.stringify([...this.processedFiles], null, 2));
        } catch (error: any) {
            console.error('Błąd zapisywania processed_files.json:', error.message);
        }
    }

    async processNewFiles(): Promise<void> {
        try {
            console.log('🔍 Skanowanie Google Drive dla nowych plików...');

            const filesData = await this.driveClient.listFiles();
            const supportedFiles = filesData.files.filter((file: DriveFile) =>
              this.driveClient.isSupportedFile(file.mimeType, file.name)
            );

            console.log(`📊 Znaleziono ${supportedFiles.length} obsługiwanych plików`);

            for (const file of supportedFiles) {
                if (!this.processedFiles.has(file.id)) {
                    await this.processGoogleDriveFile(file);
                    // Pauza między plikami
                    await this.sleep(2000);
                }
            }

        } catch (error: any) {
            console.error('❌ Błąd przetwarzania nowych plików:', error.message);
        }
    }

    async processGoogleDriveFile(file: DriveFile): Promise<void> {
        console.log(`📄 Przetwarzanie: ${file.name} (${file.id})`);

        try {
            // Pobierz plik z Google Drive
            const tempFilePath = await this.driveClient.downloadFile(file.id, file.name);

            // Przetwórz plik
            const result = await this.processLocalFile(tempFilePath, file);

            if (result.success) {
                // Oznacz jako przetworzony
                this.processedFiles.add(file.id);
                this.saveProcessedFiles();

                // Przenieś do folderu przetworzonych (opcjonalne)
                if (fileConfig.googleDrive.processedFolderId) {
                    await this.driveClient.moveFile(file.id, fileConfig.googleDrive.processedFolderId);
                }

                console.log(`✅ Pomyślnie przetworzono: ${file.name}`);
            }

            // Usuń tymczasowy plik
            await fs.unlink(tempFilePath);

        } catch (error: any) {
            console.error(`❌ Błąd przetwarzania ${file.name}:`, error.message);
        }
    }

    async processLocalFile(filePath: string, fileInfo: DriveFile | null = null): Promise<ProcessResult> {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let invoiceData: InvoiceData | null;

        // Wyciągnij dane w zależności od typu pliku
        if (ext === '.pdf') {
            invoiceData = await this.extractFromPDF(filePath);
        } else if (ext === '.xlsx' || ext === '.xls') {
            invoiceData = this.extractFromExcel(filePath);
        } else {
            return { success: false, error: 'Nieobsługiwany typ pliku' };
        }

        if (!invoiceData || !invoiceData.identifier) {
            return { success: false, error: 'Nie udało się wyciągnąć danych' };
        }

        // Dodaj metadane z Google Drive
        if (fileInfo) {
            invoiceData.source = 'Google Drive';
            invoiceData.sourceFileId = fileInfo.id;
            invoiceData.sourceFileName = fileInfo.name;
            invoiceData.uploadDate = fileInfo.modifiedTime;
        }

        // Określ typ dokumentu
        const isExpense = this.isExpenseDocument(fileName, invoiceData);

        let result;
        if (isExpense) {
            result = await this.api.sendExpense({
                identifier: invoiceData.identifier,
                issueDate: invoiceData.issueDate,
                purchaseDate: invoiceData.saleDate,
                supplierName: invoiceData.clientName,
                supplierNip: invoiceData.clientNip,
                items: invoiceData.items
            });
        } else {
            result = await this.api.sendInvoice(invoiceData);
        }

        return result;
    }

    isExpenseDocument(fileName: string, data: InvoiceData): boolean {
        const expenseKeywords = ['wydatek', 'koszty', 'rachunek', 'paragon', 'expense'];
        const fileNameLower = fileName.toLowerCase();

        return expenseKeywords.some(keyword => fileNameLower.includes(keyword)) ||
          (!!data.identifier && data.identifier.toLowerCase().includes('wy'));
    }

    async extractFromPDF(filePath: string): Promise<InvoiceData | null> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const text = await pdfToText(dataBuffer);

            return this.parseInvoiceText(text);
        } catch (error: any) {
            console.error('Błąd przy czytaniu PDF:', error.message);
            return null;
        }
    }

    extractFromExcel(filePath: string): InvoiceData | null {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new Error('No worksheets found in Excel file');
            }
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error('Unable to access worksheet');
            }
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            // Przykładowa struktura - dostosuj do swoich plików
            const invoiceData: InvoiceData = {
                identifier: data[1]?.[0] || '',
                issueDate: this.formatDate(data[1]?.[1]),
                saleDate: this.formatDate(data[1]?.[2]),
                clientName: data[1]?.[3] || '',
                clientNip: data[1]?.[4] || '',
                clientAddress: data[1]?.[5] || '',
                items: []
            };

            // Pozycje faktury (od wiersza 4)
            for (let i = 3; i < data.length; i++) {
                const row = data[i];
                if (row && row[0]) {
                    invoiceData.items.push({
                        StawkaVat: parseFloat(row[0]) || 23,
                        Nazwa: row[1] || '',
                        Ilosc: parseFloat(row[2]) || 1,
                        Cena: parseFloat(row[3]) || 0
                    });
                }
            }

            return invoiceData;
        } catch (error: any) {
            console.error('Błąd przy czytaniu Excel:', error.message);
            return null;
        }
    }

    parseInvoiceText(text: string): InvoiceData {
        const invoiceData: InvoiceData = {
            identifier: '',
            issueDate: new Date().toISOString().split('T')[0],
            saleDate: new Date().toISOString().split('T')[0],
            clientName: '',
            clientNip: '',
            clientAddress: '',
            items: []
        };

        try {
            // Parsowanie podobne jak wcześniej
            const invoiceNumberMatch = text.match(/(?:Faktura|Invoice)\s*(?:nr|number|#):?\s*([^\s\n]+)/i);
            if (invoiceNumberMatch && invoiceNumberMatch[1]) {
                invoiceData.identifier = invoiceNumberMatch[1];
            }

            const issueDateMatch = text.match(/Data\s*wystawienia:?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i);
            if (issueDateMatch && issueDateMatch[1]) {
                invoiceData.issueDate = this.formatDate(issueDateMatch[1]);
            }

            const saleDateMatch = text.match(/Data\s*sprzedaży:?\s*(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/i);
            if (saleDateMatch && saleDateMatch[1]) {
                invoiceData.saleDate = this.formatDate(saleDateMatch[1]);
            }

            const clientNameMatch = text.match(/(?:Nabywca|Customer|Client):?\s*\n([^\n]+)/i);
            if (clientNameMatch && clientNameMatch[1]) {
                invoiceData.clientName = clientNameMatch[1].trim();
            }

            const nipMatch = text.match(/(?:NIP|TAX\s*ID):?\s*(\d{10})/i);
            if (nipMatch && nipMatch[1]) {
                invoiceData.clientNip = nipMatch[1];
            }

            // Parsowanie pozycji - dostosuj do formatu swoich faktur
            this.parseInvoiceItems(text, invoiceData);

        } catch (error: any) {
            console.error('Błąd parsowania tekstu faktury:', error.message);
        }

        return invoiceData;
    }

    parseInvoiceItems(text: string, invoiceData: InvoiceData): void {
        // Szukaj sekcji z pozycjami
        const itemsSectionMatch = text.match(/(?:Nazwa|Description|Item).*?(?:Wartość|Total|Amount).*?\n([\s\S]*?)(?:Razem|Total|Sum|Podsumowanie|$)/i);

        if (itemsSectionMatch && itemsSectionMatch[1]) {
            const itemsText = itemsSectionMatch[1];
            const lines = itemsText.split('\n').filter(line => line.trim());

            lines.forEach((line: string) => {
                // Dopasuj wzorzec: nazwa | ilość | cena | vat
                const itemMatch = line.match(/(.+?)\s+(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)/);
                if (itemMatch && itemMatch[1] && itemMatch[2] && itemMatch[3] && itemMatch[4]) {
                    invoiceData.items.push({
                        Nazwa: itemMatch[1].trim(),
                        Ilosc: parseFloat(itemMatch[2].replace(',', '.')),
                        Cena: parseFloat(itemMatch[3].replace(',', '.')),
                        StawkaVat: parseFloat(itemMatch[4].replace(',', '.'))
                    });
                }
            });
        }

        // Jeśli nie znaleziono pozycji, dodaj domyślną
        if (invoiceData.items.length === 0) {
            invoiceData.items.push({
                Nazwa: 'Usługa/Towar',
                Ilosc: 1,
                Cena: 0,
                StawkaVat: 23
            });
        }
    }

    formatDate(dateStr: any): string {
        if (!dateStr) return '';

        try {
            let date;
            if (dateStr.includes('-')) {
                date = new Date(dateStr);
            } else if (dateStr.includes('.') || dateStr.includes('/')) {
                const parts = dateStr.split(/[./]/);
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                return dateStr;
            }

            const isoString = date.toISOString().split('T')[0];
            return isoString || '';
        } catch (error: any) {
            console.error('Błąd formatowania daty:', error.message);
            return '';
        }
    }

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default FileProcessor;