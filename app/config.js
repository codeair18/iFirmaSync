// config.js
require('dotenv').config();

const config = {
    googleDrive: {
        keyFile: './service-account-key.json', // Pobrane z Google Cloud Console
        scopes: ['https://www.googleapis.com/auth/drive'],
        folderId: process.env.GDRIVE_FOLDER_ID, // ID folderu do monitorowania
        processedFolderId: process.env.GDRIVE_PROCESSED_FOLDER_ID // Folder dla przetworzonych plików
    },
    ifirma: {
        baseUrl: 'https://www.ifirma.pl/iapi/',
        username: process.env.IFIRMA_USERNAME,
        invoiceKey: process.env.IFIRMA_INVOICE_KEY,
        userKey: process.env.IFIRMA_USER_KEY
    },
    webhook: {
        url: process.env.WEBHOOK_URL || 'https://your-domain.com/webhook',
        secret: process.env.WEBHOOK_SECRET || 'your-secret-key'
    },
    server: {
        port: process.env.PORT || 3000
    },
    processedFiles: './processed_files.json',
    logLevel: 'info'
};

module.exports = config;