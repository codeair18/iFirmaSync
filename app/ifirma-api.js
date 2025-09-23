const axios = require('axios');
const crypto = require('crypto-js');
const config = require('./config');

class iFirmaAPI {
    constructor() {
        this.baseUrl = config.ifirma.baseUrl;
        this.username = config.ifirma.username;
        this.invoiceKey = config.ifirma.invoiceKey;
        this.userKey = config.ifirma.userKey;
    }

    generateAuthHash(data) {
        const authString = `${this.username}${this.invoiceKey}${JSON.stringify(data)}`;
        return crypto.SHA1(authString).toString();
    }

    async sendInvoice(invoiceData) {
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
            'Authentication': `${this.username},${authHash}`
        };

        try {
            const response = await axios.post(url, payload, { headers });
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async sendExpense(expenseData) {
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
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = iFirmaAPI;