// index.js
const app = require('./webhook-server');
const FileProcessor = require('./file-processor');
const config = require('./config');

class GDriveiFirmaWorkflow {
    constructor() {
        this.processor = new FileProcessor();
        this.server = null;
    }

    async start() {
        console.log('🚀 Uruchamianie Google Drive → iFirma Workflow');

        // Initialize Google Drive connection
        const initialized = await this.processor.initialize();
        if (!initialized) {
            console.error('❌ Nie udało się połączyć z Google Drive API');
            process.exit(1);
        }

        // Start webhook server
        this.server = app.listen(config.server.port, () => {
            console.log(`🌐 Webhook server listening on port ${config.server.port}`);
        });

        // Setup Google Drive webhook
        try {
            await this.processor.driveClient.setupWebhook();
            console.log('✅ Google Drive webhook configured');
        } catch (error) {
            console.warn('⚠️ Could not setup webhook, falling back to polling mode');
            this.startPolling();
        }

        // Initial scan for existing files
        console.log('📄 Przetwarzanie istniejących plików...');
        await this.processor.processNewFiles();

        console.log('✅ Workflow uruchomiony pomyślnie!');
    }

    startPolling() {
        // Fallback: poll for new files every 5 minutes
        setInterval(async () => {
            try {
                console.log('🔄 Polling for new files...');
                await this.processor.processNewFiles();
            } catch (error) {
                console.error('Polling error:', error.message);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    async stop() {
        if (this.server) {
            this.server.close();
            console.log('🛑 Webhook server stopped');
        }
    }
}

// Handle process signals
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

// Start application
if (require.main === module) {
    const workflow = new GDriveiFirmaWorkflow();

    if (process.argv.includes('--manual')) {
        // Manual mode - process once and exit
        workflow.processor.initialize()
        .then(() => workflow.processor.processNewFiles())
        .then(() => {
            console.log('✅ Manual processing completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error:', error.message);
            process.exit(1);
        });
    } else {
        // Daemon mode
        workflow.start().catch(error => {
            console.error('❌ Startup error:', error.message);
            process.exit(1);
        });
    }
}

module.exports = GDriveiFirmaWorkflow;