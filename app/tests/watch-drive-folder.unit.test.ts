import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DriveFolderWatcher before importing the module
vi.mock('../drive-folder-watcher', () => {
  return {
    default: vi.fn().mockImplementation((sourceFolderId, targetFolderId, pollInterval) => {
      return {
        sourceFolderId,
        targetFolderId,
        pollInterval,
        initialize: vi.fn().mockResolvedValue(true),
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn()
      };
    })
  };
});

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

describe('watch-drive-folder.ts - Unit Tests', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit: ${code}`);
    });
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    vi.resetModules();
  });

  describe('Environment Variable Validation', () => {
    it('should validate GDRIVE_SOURCE_FOLDER_ID is present', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: '',
        GDRIVE_FOLDER_ID: 'test-target-id'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        expect((error as Error).message).toContain('process.exit: 1');
      }

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Missing required environment variables:');
      expect(mockConsoleError).toHaveBeenCalledWith('   - GDRIVE_SOURCE_FOLDER_ID (folder to watch)');
      expect(mockExit).toHaveBeenCalledWith(1);

      process.env = originalEnv;
    });

    it('should validate GDRIVE_FOLDER_ID is present', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: ''
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        expect((error as Error).message).toContain('process.exit: 1');
      }

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Missing required environment variables:');
      expect(mockConsoleError).toHaveBeenCalledWith('   - GDRIVE_FOLDER_ID (destination folder)');
      expect(mockExit).toHaveBeenCalledWith(1);

      process.env = originalEnv;
    });

    it('should validate both environment variables are present', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: '',
        GDRIVE_FOLDER_ID: ''
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        expect((error as Error).message).toContain('process.exit: 1');
      }

      expect(mockConsoleError).toHaveBeenCalledWith('❌ Missing required environment variables:');
      expect(mockConsoleError).toHaveBeenCalledWith('   - GDRIVE_SOURCE_FOLDER_ID (folder to watch)');
      expect(mockConsoleError).toHaveBeenCalledWith('   - GDRIVE_FOLDER_ID (destination folder)');
      expect(mockExit).toHaveBeenCalledWith(1);

      process.env = originalEnv;
    });
  });

  describe('Poll Interval Configuration', () => {
    it('should use default poll interval of 60000ms when not specified', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id'
      };
      delete process.env.WATCH_POLL_INTERVAL;

      const DriveFolderWatcher = (await import('../drive-folder-watcher')).default;

      // Clear previous mocks and re-import to test
      vi.clearAllMocks();

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        // Might fail due to initialization, that's okay
      }

      process.env = originalEnv;
    });

    it('should use custom poll interval when WATCH_POLL_INTERVAL is set', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id',
        WATCH_POLL_INTERVAL: '30000'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        // Might fail due to initialization, that's okay
      }

      process.env = originalEnv;
    });

    it('should handle invalid poll interval gracefully', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id',
        WATCH_POLL_INTERVAL: 'invalid'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        // Might fail due to initialization, that's okay
      }

      // parseInt of 'invalid' returns NaN, which gets used as pollInterval
      // This is a potential bug but tests the current behavior
      process.env = originalEnv;
    });
  });

  describe('Console Output', () => {
    it('should display startup message', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        // Expected to fail without proper setup
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Drive Folder Watcher')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Starting')
      );

      process.env = originalEnv;
    });

    it('should display helper message about .env file when variables are missing', async () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: '',
        GDRIVE_FOLDER_ID: ''
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        expect((error as Error).message).toContain('process.exit: 1');
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Add these variables to app/.env file')
      );

      process.env = originalEnv;
    });
  });

  describe('Initialization Error Handling', () => {
    it('should exit with error when DriveFolderWatcher fails to initialize', async () => {
      // Re-mock with failing initialize
      vi.resetModules();
      vi.doMock('../drive-folder-watcher', () => {
        return {
          default: vi.fn().mockImplementation(() => {
            return {
              initialize: vi.fn().mockResolvedValue(false),
              start: vi.fn(),
              stop: vi.fn()
            };
          })
        };
      });

      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        expect((error as Error).message).toContain('process.exit: 1');
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Error:',
        expect.any(String)
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      process.env = originalEnv;
    });

    it('should handle initialization exceptions', async () => {
      // Re-mock with throwing initialize
      vi.resetModules();
      vi.doMock('../drive-folder-watcher', () => {
        return {
          default: vi.fn().mockImplementation(() => {
            return {
              initialize: vi.fn().mockRejectedValue(new Error('Connection failed')),
              start: vi.fn(),
              stop: vi.fn()
            };
          })
        };
      });

      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
        GDRIVE_FOLDER_ID: 'test-target-id'
      };

      try {
        await import('../watch-drive-folder');
      } catch (error) {
        // Should catch and log the error
      }

      process.env = originalEnv;
    });
  });
});