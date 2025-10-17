import { vi } from 'vitest';

export class MockDriveFolderWatcher {
  sourceFolderId: string;
  targetFolderId: string;
  pollInterval: number;
  initialize = vi.fn();
  start = vi.fn();
  stop = vi.fn();

  constructor(sourceFolderId: string, targetFolderId: string, pollInterval: number) {
    this.sourceFolderId = sourceFolderId;
    this.targetFolderId = targetFolderId;
    this.pollInterval = pollInterval;

    // Default mock implementations
    this.initialize.mockResolvedValue(true);
    this.start.mockResolvedValue(undefined);
    this.stop.mockReturnValue(undefined);
  }
}

export default MockDriveFolderWatcher;