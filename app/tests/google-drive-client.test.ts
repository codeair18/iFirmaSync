import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, Writable } from 'stream';
import GoogleDriveClient from '../google-drive-client';

// Hoist mocks to avoid initialization issues
const { mockGetClient, mockWatch, mockList, mockGet, mockUpdate, mockCreate, mockEnsureDir, mockCreateWriteStream } = vi.hoisted(() => ({
  mockGetClient: vi.fn(),
  mockWatch: vi.fn(),
  mockList: vi.fn(),
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockEnsureDir: vi.fn(),
  mockCreateWriteStream: vi.fn()
}));

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: mockGetClient
      }))
    },
    drive: vi.fn().mockReturnValue({
      files: {
        watch: mockWatch,
        list: mockList,
        get: mockGet,
        update: mockUpdate,
        create: mockCreate
      }
    })
  }
}));

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    ensureDir: mockEnsureDir,
    createWriteStream: mockCreateWriteStream
  }
}));

// Mock config
vi.mock('../config', () => ({
  default: {
    googleDrive: {
      keyFile: './test-key.json',
      scopes: ['https://www.googleapis.com/auth/drive'],
      folderId: 'test-folder-id',
      processedFolderId: 'test-processed-folder-id'
    },
    webhook: {
      url: 'https://test.example.com/webhook',
      secret: 'test-secret'
    }
  }
}));

describe('GoogleDriveClient', () => {
  let client: GoogleDriveClient;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    client = new GoogleDriveClient();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('constructor', () => {
    it('should create an instance with auth and drive client', () => {
      expect(client).toBeDefined();
      expect(client.drive).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should successfully authenticate and return true', async () => {
      mockGetClient.mockResolvedValue({});

      const result = await client.initialize();

      expect(result).toBe(true);
      expect(mockGetClient).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Google Drive API authenticated successfully');
    });

    it('should handle authentication failure and return false', async () => {
      mockGetClient.mockRejectedValue(new Error('Authentication failed'));

      const result = await client.initialize();

      expect(result).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Google Drive authentication failed:',
        'Authentication failed'
      );
    });
  });

  describe('setupWebhook', () => {
    it('should successfully setup webhook', async () => {
      const mockResponse = {
        data: {
          id: 'webhook-123',
          resourceId: 'resource-123',
          expiration: '1234567890'
        }
      };
      mockWatch.mockResolvedValue(mockResponse);

      const result = await client.setupWebhook();

      expect(result).toEqual(mockResponse.data);
      expect(mockWatch).toHaveBeenCalledWith({
        fileId: 'test-folder-id',
        requestBody: {
          id: expect.stringContaining('ifirma-webhook-'),
          type: 'web_hook',
          address: 'https://test.example.com/webhook',
          token: 'test-secret',
          expiration: expect.any(String)
        }
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '🔔 Google Drive webhook configured:',
        mockResponse.data
      );
    });

    it('should handle webhook setup failure', async () => {
      mockWatch.mockRejectedValue(new Error('Webhook setup failed'));

      await expect(client.setupWebhook()).rejects.toThrow('Webhook setup failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Webhook setup failed:',
        'Webhook setup failed'
      );
    });
  });

  describe('listFiles', () => {
    it('should list files in default folder', async () => {
      const mockFiles = [
        { id: 'file1', name: 'test1.pdf', mimeType: 'application/pdf' },
        { id: 'file2', name: 'test2.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      ];
      const mockResponse = {
        data: {
          files: mockFiles,
          nextPageToken: null
        }
      };
      mockList.mockResolvedValue(mockResponse);

      const result = await client.listFiles();

      expect(result).toEqual(mockResponse.data);
      expect(mockList).toHaveBeenCalledWith({
        q: "'test-folder-id' in parents and trashed=false",
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Listing files with query')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Found 2 items')
      );
    });

    it('should list files in specified folder', async () => {
      const mockResponse = {
        data: {
          files: [],
          nextPageToken: null
        }
      };
      mockList.mockResolvedValue(mockResponse);

      await client.listFiles('custom-folder-id');

      expect(mockList).toHaveBeenCalledWith({
        q: "'custom-folder-id' in parents and trashed=false",
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true
      });
    });

    it('should include pageToken when provided', async () => {
      const mockResponse = {
        data: {
          files: [],
          nextPageToken: null
        }
      };
      mockList.mockResolvedValue(mockResponse);

      await client.listFiles(null, 'next-page-token');

      expect(mockList).toHaveBeenCalledWith({
        q: "'test-folder-id' in parents and trashed=false",
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken: 'next-page-token'
      });
    });

    it('should handle errors when listing files', async () => {
      mockList.mockRejectedValue(new Error('List failed'));

      await expect(client.listFiles()).rejects.toThrow('List failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error listing files:',
        'List failed'
      );
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const mockStream = new Readable();
      mockStream.push('file content');
      mockStream.push(null);

      const mockWriter = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });

      // Spy on finish event
      const finishSpy = vi.fn();
      mockWriter.on('finish', finishSpy);

      mockGet.mockResolvedValue({ data: mockStream });
      mockEnsureDir.mockResolvedValue(undefined);
      mockCreateWriteStream.mockReturnValue(mockWriter);

      const result = await client.downloadFile('file-123', 'test.pdf');

      expect(result).toContain('test.pdf');
      expect(mockEnsureDir).toHaveBeenCalledWith('./temp');
      expect(mockGet).toHaveBeenCalledWith(
        {
          fileId: 'file-123',
          alt: 'media'
        },
        { responseType: 'stream' }
      );
    });

    it('should handle download errors', async () => {
      mockGet.mockRejectedValue(new Error('Download failed'));
      mockEnsureDir.mockResolvedValue(undefined);

      await expect(client.downloadFile('file-123', 'test.pdf')).rejects.toThrow('Download failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error downloading file test.pdf:',
        'Download failed'
      );
    });

    it('should handle write stream errors', async () => {
      const mockStream = new Readable();
      mockStream.push('file content');
      mockStream.push(null);

      const mockWriter = new Writable({
        write(chunk, encoding, callback) {
          // Simulate error on write
          callback(new Error('Write failed'));
        }
      });

      mockGet.mockResolvedValue({ data: mockStream });
      mockEnsureDir.mockResolvedValue(undefined);
      mockCreateWriteStream.mockReturnValue(mockWriter);

      await expect(client.downloadFile('file-123', 'test.pdf')).rejects.toThrow('Write failed');
    });
  });

  describe('moveFile', () => {
    it('should move file to new folder', async () => {
      mockGet.mockResolvedValue({
        data: {
          parents: ['old-folder-id']
        }
      });
      mockUpdate.mockResolvedValue({ data: {} });

      await client.moveFile('file-123', 'new-folder-id');

      expect(mockGet).toHaveBeenCalledWith({
        fileId: 'file-123',
        fields: 'parents'
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        fileId: 'file-123',
        addParents: 'new-folder-id',
        removeParents: 'old-folder-id'
      });
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📁 File file-123 moved to processed folder'
      );
    });

    it('should handle file with no parents', async () => {
      mockGet.mockResolvedValue({
        data: {
          parents: undefined
        }
      });
      mockUpdate.mockResolvedValue({ data: {} });

      await client.moveFile('file-123', 'new-folder-id');

      expect(mockUpdate).toHaveBeenCalledWith({
        fileId: 'file-123',
        addParents: 'new-folder-id',
        removeParents: ''
      });
    });

    it('should handle errors when moving file', async () => {
      mockGet.mockRejectedValue(new Error('Move failed'));

      await expect(client.moveFile('file-123', 'new-folder-id')).rejects.toThrow('Move failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error moving file:',
        'Move failed'
      );
    });
  });

  describe('createFolder', () => {
    it('should create folder without parent', async () => {
      mockCreate.mockResolvedValue({
        data: {
          id: 'new-folder-id'
        }
      });

      const result = await client.createFolder('New Folder');

      expect(result).toBe('new-folder-id');
      expect(mockCreate).toHaveBeenCalledWith({
        requestBody: {
          name: 'New Folder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: undefined
        }
      });
    });

    it('should create folder with parent', async () => {
      mockCreate.mockResolvedValue({
        data: {
          id: 'new-folder-id'
        }
      });

      const result = await client.createFolder('New Folder', 'parent-folder-id');

      expect(result).toBe('new-folder-id');
      expect(mockCreate).toHaveBeenCalledWith({
        requestBody: {
          name: 'New Folder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['parent-folder-id']
        }
      });
    });

    it('should handle errors when creating folder', async () => {
      mockCreate.mockRejectedValue(new Error('Create failed'));

      await expect(client.createFolder('New Folder')).rejects.toThrow('Create failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error creating folder New Folder:',
        'Create failed'
      );
    });
  });

  describe('searchFiles', () => {
    it('should search files without folder filter', async () => {
      const mockFiles = [
        { id: 'file1', name: 'invoice.pdf' }
      ];
      mockList.mockResolvedValue({
        data: {
          files: mockFiles
        }
      });

      const result = await client.searchFiles('name contains "invoice"');

      expect(result).toEqual(mockFiles);
      expect(mockList).toHaveBeenCalledWith({
        q: 'name contains "invoice" and trashed=false',
        fields: 'files(id, name, mimeType, modifiedTime, size)'
      });
    });

    it('should search files with folder filter', async () => {
      const mockFiles = [
        { id: 'file1', name: 'invoice.pdf' }
      ];
      mockList.mockResolvedValue({
        data: {
          files: mockFiles
        }
      });

      const result = await client.searchFiles('name contains "invoice"', 'folder-123');

      expect(result).toEqual(mockFiles);
      expect(mockList).toHaveBeenCalledWith({
        q: 'name contains "invoice" and \'folder-123\' in parents and trashed=false',
        fields: 'files(id, name, mimeType, modifiedTime, size)'
      });
    });

    it('should handle search errors', async () => {
      mockList.mockRejectedValue(new Error('Search failed'));

      await expect(client.searchFiles('test')).rejects.toThrow('Search failed');
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error searching files:',
        'Search failed'
      );
    });
  });

  describe('isSupportedFile', () => {
    it('should return true for PDF mime type', () => {
      expect(client.isSupportedFile('application/pdf', 'test.pdf')).toBe(true);
    });

    it('should return true for XLSX mime type', () => {
      expect(client.isSupportedFile(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'test.xlsx'
      )).toBe(true);
    });

    it('should return true for XLS mime type', () => {
      expect(client.isSupportedFile('application/vnd.ms-excel', 'test.xls')).toBe(true);
    });

    it('should return true for .pdf extension', () => {
      expect(client.isSupportedFile('', 'document.pdf')).toBe(true);
    });

    it('should return true for .xlsx extension', () => {
      expect(client.isSupportedFile('', 'spreadsheet.xlsx')).toBe(true);
    });

    it('should return true for .xls extension', () => {
      expect(client.isSupportedFile('', 'spreadsheet.xls')).toBe(true);
    });

    it('should return true for .PDF extension (case insensitive)', () => {
      expect(client.isSupportedFile('', 'document.PDF')).toBe(true);
    });

    it('should return false for unsupported mime type and extension', () => {
      expect(client.isSupportedFile('text/plain', 'test.txt')).toBe(false);
    });

    it('should return false for unsupported extension', () => {
      expect(client.isSupportedFile('', 'test.doc')).toBe(false);
    });

    it('should return false for no mime type and no extension', () => {
      expect(client.isSupportedFile('', 'test')).toBe(false);
    });
  });
});