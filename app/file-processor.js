// file-processor.js
const fs = require('fs-extra');
const path = require('path');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
const crypto = require('crypto');
const GoogleDriveClient = require('./google-drive-client');
const iFirmaAPI = require('./ifirma-api');
const config = require('./config');

class FileProcessor {
    constructor() {
        this.driveClient = new GoogleDriveClient();
        this.api = new iFirmaAPI();
        this.processedFiles = this.loadProcessedFiles();
    }

    async initialize() {
        return await this.driveClient.initialize();
    }

    loadProcessedFiles() {
        try {
            if (fs.existsSync(config.processedFiles)) {
                const data = fs.readFileSync(config.processedFiles, 'utf8');
                return new Set(JSON.parse(data));
            }
        } catch (error) {
            console.log('Tworzenie nowego pliku processed_files.json');
        }
        return new Set();
    }

    saveProcessedFiles() {
        try {
            fs.writeFileSync(config.processedFiles, JSON.stringify([...this.processedFiles], null, 2));
        } catch (error) {
            console.error('Błąd zapisywania processed_files.json:', error.message);
        }
    }

    async processNewFiles() {
        try {
            console.log('🔍 Skanowanie Google Drive dla nowych plików...');

            const filesData = await this.driveClient.listFiles();
            const supportedFiles = filesData.files.filter(file =>
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

        } catch (error) {
            console.error('❌ Błąd przetwarzania nowych plików:', error.message);
        }
    }

    async processGoogleDriveFile(file) {
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
                if (config.googleDrive.processedFolderId) {
                    await this.driveClient.moveFile(file.id, config.googleDrive.processedFolderId);
                }

                console.log(`✅ Pomyślnie przetworzono: ${file.name}`);
            }

            // Usuń tymczasowy plik
            await fs.unlink(tempFilePath);

        } catch (error) {
            console.error(`❌ Błąd przetwarzania ${file.name}:`, error.message);
        }
    }

    async processLocalFile(filePath, fileInfo = null) {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let invoiceData;

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

    isExpenseDocument(fileName, data) {
        const expenseKeywords = ['wydatek', 'koszty', 'rachunek', 'paragon', 'expense'];
        const fileNameLower = fileName.toLowerCase();

        return expenseKeywords.some(keyword => fileNameLower.includes(keyword)) ||
          (data.identifier && data.identifier.toLowerCase().includes('wy'));
    }

    async extractFromPDF(filePath) {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdf(dataBuffer);
            const text = pdfData.text;

            return this.parseInvoiceText(text);
        } catch (error) {
            console.error('Błąd przy czytaniu PDF:', error.message);
            return null;
        }
    }

    extractFromExcel(filePath) {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

            // Przykładowa struktura - dostosuj do swoich plików
            const invoiceData = {
                identifier: data[1]?.[0] || '',
                issueDate: this.formatDate(data[1]?.[1]),
                saleDate: this.formatDate(data[1]?.[2]),
                clientName: data[1]?.[3] || '',
                clientNip: data[1]?.[4] || '',
                clientAddress: data[1]?.[5] || '',
                paymentMethod: data[1]?.[6] || 'Przelew',
                paymentDeadline: this.formatDate(data[1]?.[7]),
                items: []
            };

            // Pozycje faktury (od wiersza 4)
            for (let i = 3; i < data.length; i++) {
                if (data[i] && data[i][0]) {
                    invoiceData.items.push({
                        StawkaVat: parseFloat(data[i][0]) || 23,
                        Nazwa: data[i][1] || '',
                        Ilosc: parseFloat(data[i][2]) || 1,
                        Cena: parseFloat(data[i][3]) || 0
                    });
                }
            }

            return invoiceData;
        } catch (error) {
            console.error('Błąd przy czytaniu Excel:', error.message);
            return null;
        }
    }

    parseInvoiceText(text) {
        const invoiceData = {
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
            if (invoiceNumberMatch) {
                invoiceData.identifier = invoiceNumberMatch[1];
            }

            const issueDateMatch = text.match(/Data\s*wystawienia:?\s*(\d{4}-\d{2}-\d{2}|\d{2}[\.\/]\d{2}[\.\/]\d{4})/i);
            if (issueDateMatch) {
                invoiceData.issueDate = this.formatDate(issueDateMatch[1]);
            }

            const saleDateMatch = text.match(/Data\s*sprzedaży:?\s*(\d{4}-\d{2}-\d{2}|\d{2}[\.\/]\d{2}[\.\/]\d{4})/i);
            if (saleDateMatch) {
                invoiceData.saleDate = this.formatDate(saleDateMatch[1]);
            }

            const clientNameMatch = text.match(/(?:Nabywca|Customer|Client):?\s*\n([^\n]+)/i);
            if (clientNameMatch) {
                invoiceData.clientName = clientNameMatch[1].trim();
            }

            const nipMatch = text.match(/(?:NIP|TAX\s*ID):?\s*(\d{10})/i);
            if (nipMatch) {
                invoiceData.clientNip = nipMatch[1];
            }

            // Parsowanie pozycji - dostosuj do formatu swoich faktur
            this.parseInvoiceItems(text, invoiceData);

        } catch (error) {
            console.error('Błąd parsowania tekstu faktury:', error.message);
        }

        return invoiceData;
    }

    parseInvoiceItems(text, invoiceData) {
        // Szukaj sekcji z pozycjami
        const itemsSectionMatch = text.match(/(?:Nazwa|Description|Item).*?(?:Wartość|Total|Amount).*?\n([\s\S]*?)(?:Razem|Total|Sum|Podsumowanie|$)/i);

        if (itemsSectionMatch) {
            const itemsText = itemsSectionMatch[1];
            const lines = itemsText.split('\n').filter(line => line.trim());

            lines.forEach(line => {
                // Dopasuj wzorzec: nazwa | ilość | cena | vat
                const itemMatch = line.match(/(.+?)\s+(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)\s+(\d+(?:,\d+)?)/);
                if (itemMatch) {
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

    formatDate(dateStr) {
        if (!dateStr) return '';

        try {
            let date;
            if (dateStr.includes('-')) {
                date = new Date(dateStr);
            } else if (dateStr.includes('.') || dateStr.includes('/')) {
                const parts = dateStr.split(/[\.\/]/);
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            } else {
                return dateStr;
            }

            return date.toISOString().split('T')[0];
        } catch (error) {
            console.error('Błąd formatowania daty:', error.message);
            return '';
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = FileProcessor;