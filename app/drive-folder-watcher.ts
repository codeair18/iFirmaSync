import GoogleDriveClient from './google-drive-client';

/**
 * Watches a Google Drive folder and copies new files to a target folder
 */
class DriveFolderWatcher {
  private sourceFolderId: string;
  private targetFolderId: string;
  private pollInterval: number;
  private intervalId?: NodeJS.Timeout;
  private driveClient?: GoogleDriveClient;
  private processedFiles: Set<string> = new Set();

  constructor(sourceFolderId: string, targetFolderId: string, pollInterval: number = 60000) {
    this.sourceFolderId = sourceFolderId;
    this.targetFolderId = targetFolderId;
    this.pollInterval = pollInterval;
  }

  /**
   * Initialize the Google Drive client and connection
   */
  async initialize(): Promise<boolean> {
    try {
      this.driveClient = new GoogleDriveClient();
      const initialized = await this.driveClient.initialize();

      if (!initialized) {
        return false;
      }

      console.log(`📂 Source folder: ${this.sourceFolderId}`);
      console.log(`📂 Target folder: ${this.targetFolderId}`);
      console.log(`⏱️  Poll interval: ${this.pollInterval}ms`);

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', (error as Error).message);
      return false;
    }
  }

  /**
   * Start watching the source folder
   */
  async start(): Promise<void> {
    if (!this.driveClient) {
      throw new Error('DriveFolderWatcher not initialized. Call initialize() first.');
    }

    console.log('👀 Starting to watch folder...');

    // Do initial check
    await this.checkForNewFiles();

    // Set up polling
    this.intervalId = setInterval(async () => {
      await this.checkForNewFiles();
    }, this.pollInterval);

    console.log('✅ Watching started');
  }

  /**
   * Stop watching the folder
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('🛑 Watching stopped');
    }
  }

  /**
   * Check for new files in the source folder
   */
  private async checkForNewFiles(): Promise<void> {
    if (!this.driveClient) {
      return;
    }

    try {
      console.log('🔍 Checking for new files...');

      const response = await this.driveClient.listFiles(this.sourceFolderId);
      const files = response.files || [];

      const newFiles = files.filter(file =>
        file.id && !this.processedFiles.has(file.id)
      );

      if (newFiles.length === 0) {
        console.log('   No new files found');
        return;
      }

      console.log(`📄 Found ${newFiles.length} new file(s)`);

      for (const file of newFiles) {
        if (!file.id || !file.name) continue;

        try {
          // Check if file is supported
          if (!this.driveClient.isSupportedFile(file.mimeType || '', file.name)) {
            console.log(`⏭️  Skipping unsupported file: ${file.name}`);
            this.processedFiles.add(file.id);
            continue;
          }

          console.log(`📋 Processing: ${file.name}`);

          // Copy file to target folder
          await this.driveClient.moveFile(file.id, this.targetFolderId);

          // Mark as processed
          this.processedFiles.add(file.id);

          console.log(`✅ Copied: ${file.name}`);
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, (error as Error).message);
        }
      }
    } catch (error) {
      console.error('❌ Error checking for files:', (error as Error).message);
    }
  }
}

export default DriveFolderWatcher;