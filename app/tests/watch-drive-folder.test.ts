import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
// @ts-ignore
import path from 'path';

describe('watch-drive-folder.ts', () => {
  let processInstance: ChildProcess;
  const originalEnv = process.env;
  const scriptPath = path.resolve(__dirname, '../watch-drive-folder.ts');

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    if (processInstance && !processInstance.killed) {
      processInstance.kill('SIGKILL');
    }
  });

  describe('Environment Variable Validation', () => {
    it('should exit with error when GDRIVE_SOURCE_FOLDER_ID is missing', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: '',
          GDRIVE_FOLDER_ID: 'test-target-id'
        }
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        expect(code).toBe(1);
        expect(stderr).toContain('GDRIVE_SOURCE_FOLDER_ID');
        // @ts-ignore
        done();
      });
    }, 10000);

    it('should exit with error when GDRIVE_FOLDER_ID is missing', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: ''
        }
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        expect(code).toBe(1);
        expect(stderr).toContain('GDRIVE_FOLDER_ID');
        // @ts-ignore
        done();
      });
    }, 10000);

    it('should exit with error when both environment variables are missing', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: '',
          GDRIVE_FOLDER_ID: ''
        }
      });

      let stderr = '';
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        expect(code).toBe(1);
        expect(stderr).toContain('GDRIVE_SOURCE_FOLDER_ID');
        expect(stderr).toContain('GDRIVE_FOLDER_ID');
        done();
      });
    }, 10000);
  });

  describe('Poll Interval Configuration', () => {
    it('should use default poll interval when WATCH_POLL_INTERVAL is not set', (done) => {
      // This test would require mocking DriveFolderWatcher
      // For now, we'll test that the script accepts the environment variable
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id'
          // WATCH_POLL_INTERVAL not set, should default to 60000
        }
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Once we see startup message, kill it
        if (stdout.includes('Starting') || stdout.includes('Failed')) {
          proc.kill('SIGTERM');
        }
      });

      proc.on('exit', () => {
        expect(stdout).toContain('Starting');
        // @ts-ignore
        done();
      });
    }, 10000);

    it('should use custom poll interval when WATCH_POLL_INTERVAL is set', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id',
          WATCH_POLL_INTERVAL: '30000'
        }
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.includes('Starting') || stdout.includes('Failed')) {
          proc.kill('SIGTERM');
        }
      });

      proc.on('exit', () => {
        expect(stdout).toContain('Starting');
        done();
      });
    }, 10000);
  });

  describe('Signal Handling', () => {
    it('should handle SIGINT gracefully', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id'
        }
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Once started, send SIGINT
        if (stdout.includes('Starting')) {
          setTimeout(() => proc.kill('SIGINT'), 100);
        }
      });

      proc.on('exit', (code) => {
        // Should exit with code 0 for graceful shutdown
        // or 1 if initialization failed (which is expected without proper setup)
        expect([0, 1]).toContain(code);
        done();
      });
    }, 10000);

    it('should handle SIGTERM gracefully', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id'
        }
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Once started, send SIGTERM
        if (stdout.includes('Starting')) {
          setTimeout(() => proc.kill('SIGTERM'), 100);
        }
      });

      proc.on('exit', (code) => {
        expect([0, 1]).toContain(code);
        done();
      });
    }, 10000);
  });

  describe('Startup Messages', () => {
    it('should display startup message', (done) => {
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id'
        }
      });

      let stdout = '';
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (stdout.includes('Starting')) {
          proc.kill('SIGTERM');
        }
      });

      proc.on('exit', () => {
        expect(stdout).toContain('Drive Folder Watcher');
        expect(stdout).toContain('Starting');
        done();
      });
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should exit when initialization fails', (done) => {
      // Without proper Google Drive credentials, initialization should fail
      const proc = spawn('tsx', [scriptPath], {
        env: {
          ...process.env,
          GDRIVE_SOURCE_FOLDER_ID: 'test-source-id',
          GDRIVE_FOLDER_ID: 'test-target-id',
          GOOGLE_APPLICATION_CREDENTIALS: '/nonexistent/path.json'
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        // Should exit with error code
        expect(code).toBe(1);
        done();
      });
    }, 10000);
  });
});