import axios from 'axios';
import CryptoJS from 'crypto-js';
// @ts-ignore
import config from './config.ts';
import util from 'util';

interface InvoiceData {
    identifier?: string;
    issueDate?: string;
    issuePlace?: string;
    saleDate?: string;
    paymentMethod?: string;
    paymentDeadline?: string;
    clientName?: string;
    clientNip?: string;
    clientAddress?: string;
    items?: any[];
}

interface ExpenseData {
    identifier?: string;
    issueDate?: string;
    purchaseDate?: string;
    supplierName?: string;
    supplierNip?: string;
    items?: any[];
}

interface APIResponse {
    success: boolean;
    status?: number;
    data?: any;
    error?: any;
    details?: any;
}

class iFirmaAPI {
    private baseUrl: string;
    private username: string;
    private invoiceKey: string;
    private userKey: string;

    constructor() {
        this.baseUrl = config.ifirma.baseUrl;
        this.username = config.ifirma.username || '';
        this.invoiceKey = config.ifirma.invoiceKey || '';
        this.userKey = config.ifirma.userKey || '';
    }

    generateAuthHash(data: any): string {
        const authString = `${this.username}${this.invoiceKey}${JSON.stringify(data)}`;
        return CryptoJS.SHA1(authString).toString();
    }

    async sendInvoice(invoiceData: InvoiceData): Promise<APIResponse> {
        const url = `${this.baseUrl}fakturakraj.json`;

        const payload = {
            Identyfikator: invoiceData.identifier || '',
            DataWystawienia: invoiceData.issueDate || '',
            MiejsceWystawienia: invoiceData.issuePlace || 'Warszawa',
            DataSprzedazy: invoiceData.saleDate || '',
            SposobZaplaty: invoiceData.paymentMethod || 'Przelew',
            TerminPlatnosci: invoiceData.paymentDeadline || '',
            Kontrahent: {
                Nazwa: invoiceData.clientName || '',
                NIP: invoiceData.clientNip || '',
                Adres: invoiceData.clientAddress || ''
            },
            Pozycje: invoiceData.items || []
        };

        const authHash = this.generateAuthHash(payload);

        const headers = {
            'Content-Type': 'application/json',
            'Authentication': `IAPIS ${this.username},${authHash}`
        };

        try {
            const response = await axios.post(url, payload, { headers });
            return { success: true, data: response.data };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async sendExpense(expenseData: ExpenseData): Promise<APIResponse> {
        // Podobnie jak sendInvoice, ale dla wydatków
        const url = `${this.baseUrl}wydatek.json`;

        const payload = {
            Identyfikator: expenseData.identifier || '',
            DataWystawienia: expenseData.issueDate || '',
            DataZakupu: expenseData.purchaseDate || '',
            Kontrahent: {
                Nazwa: expenseData.supplierName || '',
                NIP: expenseData.supplierNip || ''
            },
            Pozycje: expenseData.items || []
        };

        const authHash = this.generateAuthHash(payload);

        const headers = {
            'Content-Type': 'application/json',
            'Authentication': `${this.username},${authHash}`
        };

        try {
            const response = await axios.post(url, payload, { headers });
            return { success: true, data: response.data };
        } catch (error: any) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async makeAPICall(endpoint: string, payload: any, method: string = 'POST'): Promise<APIResponse> {
        console.log('PAYLOAD:', util.inspect(payload, false, null, true /* enable colors */))
        const url = `${this.baseUrl}${endpoint}`;
        const authHash = this.generateAuthHash(payload);

        console.log(`Username: ${this.username}`);
        console.log(`🔑 Generated Auth Hash: ${authHash}`);

        const authHeader = `IAPIS user=${this.username}, hmac-sha1=${authHash}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authentication': authHeader,
            'User-Agent': 'InvoiceFlow-Test/1.0'
        };

        console.log(`🌐 API Call: ${method} ${endpoint}`);
        console.log(`📦 Payload size: ${JSON.stringify(payload).length} characters`);

        try {
            const response = await axios({
                method,
                url,
                data: payload,
                headers,
                timeout: 30000
            });

            return {
                success: true,
                status: response.status,
                data: response.data
            };

        } catch (error: any) {
            return {
                success: false,
                status: error.response?.status,
                error: error.response?.data || error.message,
                details: {
                    endpoint,
                    payload: JSON.stringify(payload, null, 2),
                    headers
                }
            };
        }
    }

}

export default iFirmaAPI;