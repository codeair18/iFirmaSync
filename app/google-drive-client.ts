// google-drive-client.js
import { google } from 'googleapis';
import { drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs-extra';
import path from 'path';
import config from './config';

class GoogleDriveClient {
    private auth: GoogleAuth;
    private drive: drive_v3.Drive;
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
            console.error('❌ Google Drive authentication failed:', (error as Error).message);
            return false;
        }
    }

    async setupWebhook() {
        try {
            // Setup push notification for folder changes
            const response = await this.drive.files.watch({
                fileId: config.googleDrive.folderId || '',
                requestBody: {
                    id: `ifirma-webhook-${Date.now()}`,
                    type: 'web_hook',
                    address: config.webhook.url,
                    token: config.webhook.secret,
                    expiration: (Date.now() + (7 * 24 * 60 * 60 * 1000)).toString() // 7 days
                }
            });

            console.log('🔔 Google Drive webhook configured:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Webhook setup failed:', (error as Error).message);
            throw error;
        }
    }

    async listFiles(folderId: string | null = null, pageToken: string | null = null) {
        try {
            const params = {
                q: `'${folderId || config.googleDrive.folderId}' in parents and trashed=false`,
                fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
                pageSize: 100
            };

            if (pageToken) {
                (params as any).pageToken = pageToken;
            }

            const response = await this.drive.files.list(params);
            return response.data;
        } catch (error) {
            console.error('❌ Error listing files:', (error as Error).message);
            throw error;
        }
    }

    async downloadFile(fileId: string, fileName: string) {
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
            console.error(`❌ Error downloading file ${fileName}:`, (error as Error).message);
            throw error;
        }
    }

    async moveFile(fileId: string, newFolderId: string) {
        try {
            // Get current parents
            const file = await this.drive.files.get({
                fileId: fileId,
                fields: 'parents'
            });

            const previousParents = file.data.parents?.join(',') || '';

            // Move to new folder
            await this.drive.files.update({
                fileId: fileId,
                addParents: newFolderId,
                removeParents: previousParents
            });

            console.log(`📁 File ${fileId} moved to processed folder`);
        } catch (error) {
            console.error('❌ Error moving file:', (error as Error).message);
            throw error;
        }
    }

    async createFolder(name: string, parentId: string | null = null) {
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
            console.error(`❌ Error creating folder ${name}:`, (error as Error).message);
            throw error;
        }
    }

    async searchFiles(query: string, folderId: string | null = null) {
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
            console.error('❌ Error searching files:', (error as Error).message);
            throw error;
        }
    }

    isSupportedFile(mimeType: string, fileName: string) {
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

export default GoogleDriveClient;