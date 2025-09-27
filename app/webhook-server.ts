// webhook-server.js
import express from 'express';
import crypto from 'crypto';
import FileProcessor from './file-processor';
import config from './config';

const app = express();
app.use(express.json());

const processor = new FileProcessor();

// Webhook endpoint for Google Drive notifications
app.post('/webhook/drive', async (req, res) => {
    try {
        // Verify webhook authenticity
        const token = req.headers['x-goog-channel-token'];
        if (token !== config.webhook.secret) {
            res.status(401).send('Unauthorized');
            return;
        }

        console.log('🔔 Google Drive webhook triggered');
        console.log('Headers:', req.headers);

        // Process new files
        setTimeout(async () => {
            try {
                await processor.processNewFiles();
            } catch (error) {
                console.error('Error processing webhook:', (error as Error).message);
            }
        }, 5000); // 5 second delay to ensure file is fully uploaded

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', (error as Error).message);
        res.status(500).send('Internal Server Error');
    }
});

// Manual trigger endpoint
app.post('/manual-process', async (req, res) => {
    try {
        console.log('🔄 Manual processing triggered');
        await processor.processNewFiles();
        res.json({ success: true, message: 'Processing completed' });
    } catch (error) {
        console.error('Manual process error:', (error as Error).message);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const driveConnected = await processor.initialize();
        res.json({
            status: 'ok',
            services: {
                googleDrive: driveConnected ? 'connected' : 'disconnected',
                ifirma: 'ready'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ status: 'error', error: (error as Error).message });
    }
});

const port = config.server.port;

app.listen(port, () => {
    console.log(`🚀 Webhook server running on port ${port}`);
    console.log(`📡 Health check: http://localhost:${port}/health`);
    console.log(`🔄 Manual trigger: http://localhost:${port}/manual-process`);
});
