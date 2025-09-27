// types.d.ts - Type declarations for JavaScript modules

declare module './config.js' {
  interface Config {
    googleDrive: {
      keyFile: string;
      scopes: string[];
      folderId: string;
      processedFolderId: string;
    };
    ifirma: {
      baseUrl: string;
      username: string;
      invoiceKey: string;
      userKey: string;
    };
    webhook: {
      url: string;
      secret: string;
    };
    server: {
      port: number;
    };
    processedFiles: string;
    logLevel: string;
  }

  const config: Config;
  export default config;
}

declare module './google-drive-client.js' {
  interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: string;
    parents?: string[];
  }

  interface FilesData {
    files: DriveFile[];
    nextPageToken?: string;
  }

  class GoogleDriveClient {
    constructor();
    initialize(): Promise<boolean>;
    setupWebhook(): Promise<any>;
    listFiles(folderId?: string, pageToken?: string): Promise<FilesData>;
    downloadFile(fileId: string, fileName: string): Promise<string>;
    moveFile(fileId: string, newFolderId: string): Promise<void>;
    createFolder(name: string, parentId?: string): Promise<string>;
    searchFiles(query: string, folderId?: string): Promise<DriveFile[]>;
    isSupportedFile(mimeType: string, fileName: string): boolean;
  }

  export default GoogleDriveClient;
}

declare module './webhook-server.js' {
  import { Express } from 'express';
  const app: Express;
  export default app;
}