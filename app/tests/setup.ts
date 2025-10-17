import { vi, beforeAll, afterEach } from 'vitest';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test environment variables if not provided
if (!process.env.GDRIVE_SOURCE_FOLDER_ID) {
  process.env.GDRIVE_SOURCE_FOLDER_ID = 'test-source-folder-id';
}

if (!process.env.GDRIVE_FOLDER_ID) {
  process.env.GDRIVE_FOLDER_ID = 'test-target-folder-id';
}

if (!process.env.WATCH_POLL_INTERVAL) {
  process.env.WATCH_POLL_INTERVAL = '60000';
}

// Mock console methods to reduce noise in tests
beforeAll(() => {
  // You can uncomment these if you want to suppress console output during tests
  // vi.spyOn(console, 'log').mockImplementation(() => {});
  // vi.spyOn(console, 'error').mockImplementation(() => {});
  // vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});