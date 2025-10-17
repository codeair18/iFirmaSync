// watch-drive-folder.ts
// Script to continuously watch a Google Drive folder and copy new files
import DriveFolderWatcher from './drive-folder-watcher';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

async function main() {
    console.log('🚀 Drive Folder Watcher - Starting...\n');

    // Get folder IDs from environment
    const sourceFolderId = process.env.GDRIVE_SOURCE_FOLDER_ID;
    const targetFolderId = process.env.GDRIVE_FOLDER_ID;

    if (!sourceFolderId || !targetFolderId) {
        console.error('❌ Missing required environment variables:');
        if (!sourceFolderId) console.error('   - GDRIVE_SOURCE_FOLDER_ID (folder to watch)');
        if (!targetFolderId) console.error('   - GDRIVE_FOLDER_ID (destination folder)');
        console.log('\n📝 Add these variables to app/.env file');
        process.exit(1);
    }

    // Poll interval in milliseconds (default: 1 minute)
    const pollInterval = parseInt(process.env.WATCH_POLL_INTERVAL || '60000');

    // Create and start watcher
    const watcher = new DriveFolderWatcher(sourceFolderId, targetFolderId, pollInterval);

    try {
        // Initialize connection
        const initialized = await watcher.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize Google Drive connection');
        }

        console.log('\n✅ Watcher initialized successfully');

        // Start watching
        await watcher.start();

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Received SIGINT, shutting down...');
            watcher.stop();
            console.log('👋 Goodbye!');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n\n🛑 Received SIGTERM, shutting down...');
            watcher.stop();
            console.log('👋 Goodbye!');
            process.exit(0);
        });

        // Keep process alive
        console.log('\n💡 Press Ctrl+C to stop watching\n');

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
        process.exit(1);
    }
}

// Handle unhandled errors
process.on('unhandledRejection', (error: Error) => {
    console.error('❌ Unhandled error:', error.message);
    process.exit(1);
});

// Start
main().catch(console.error);
