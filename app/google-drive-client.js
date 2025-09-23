// google-drive-client.js
const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

class GoogleDriveClient {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: config.googleDrive.keyFile,
            scopes: config.googleDrive.scopes
        });

        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    async initialize() {
        try {
            // Test authentication
            const authClient = await this.auth.getClient();
            console.log('✅ Google Drive API authenticated successfully');
            return true;
        } catch (error) {
            console.error('❌ Google Drive authentication failed:', error.message);
            return false;
        }
    }

    async setupWebhook() {
        try {
            // Setup push notification for folder changes
            const response = await this.drive.files.watch({
                fileId: config.googleDrive.folderId,
                requestBody: {
                    id: `ifirma-webhook-${Date.now()}`,
                    type: 'web_hook',
                    address: config.webhook.url,
                    token: config.webhook.secret,
                    expiration: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
                }
            });

            console.log('🔔 Google Drive webhook configured:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Webhook setup failed:', error.message);
            throw error;
        }
    }

    async listFiles(folderId = null, pageToken = null) {
        try {
            const params = {
                q: `'${folderId || config.googleDrive.folderId}' in parents and trashed=false`,
                fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
                pageSize: 100
            };

            if (pageToken) {
                params.pageToken = pageToken;
            }

            const response = await this.drive.files.list(params);
            return response.data;
        } catch (error) {
            console.error('❌ Error listing files:', error.message);
            throw error;
        }
    }

    async downloadFile(fileId, fileName) {
        try {
            const tempPath = path.join('./temp', `${Date.now()}_${fileName}`);
            await fs.ensureDir('./temp');

            const response = await this.drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });

            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(tempPath));
                writer.on('error', reject);
            });
        } catch (error) {
            console.error(`❌ Error downloading file ${fileName}:`, error.message);
            throw error;
        }
    }

    async moveFile(fileId, newFolderId) {
        try {
            // Get current parents
            const file = await this.drive.files.get({
                fileId: fileId,
                fields: 'parents'
            });

            const previousParents = file.data.parents.join(',');

            // Move to new folder
            await this.drive.files.update({
                fileId: fileId,
                addParents: newFolderId,
                removeParents: previousParents
            });

            console.log(`📁 File ${fileId} moved to processed folder`);
        } catch (error) {
            console.error('❌ Error moving file:', error.message);
            throw error;
        }
    }

    async createFolder(name, parentId = null) {
        try {
            const response = await this.drive.files.create({
                requestBody: {
                    name: name,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: parentId ? [parentId] : undefined
                }
            });

            return response.data.id;
        } catch (error) {
            console.error(`❌ Error creating folder ${name}:`, error.message);
            throw error;
        }
    }

    async searchFiles(query, folderId = null) {
        try {
            let searchQuery = query;
            if (folderId) {
                searchQuery += ` and '${folderId}' in parents`;
            }

            const response = await this.drive.files.list({
                q: searchQuery + ' and trashed=false',
                fields: 'files(id, name, mimeType, modifiedTime, size)'
            });

            return response.data.files;
        } catch (error) {
            console.error('❌ Error searching files:', error.message);
            throw error;
        }
    }

    isSupportedFile(mimeType, fileName) {
        const supportedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];

        const supportedExtensions = ['.pdf', '.xlsx', '.xls'];
        const extension = path.extname(fileName).toLowerCase();

        return supportedTypes.includes(mimeType) || supportedExtensions.includes(extension);
    }
}

module.exports = GoogleDriveClient;