# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
iFirmaSync is a Node.js/TypeScript application that synchronizes invoice files from Google Drive to the iFirma.pl accounting system. The application processes PDF and Excel files, extracts invoice data, and automatically creates entries in iFirma.

## Development Environment

### Docker Setup
This project uses Docker for development consistency:
- Main container runs Node.js LTS Alpine
- Development port: 3000
- Uses Docker Compose for orchestration with ngrok for webhooks
- Source code mounted at `/usr/src/app`
- Ngrok service exposes webhooks publicly for Google Drive notifications

### Custom Bin Scripts
**IMPORTANT**: Always use the project's bin scripts instead of direct Node.js commands:
- Use `bin/node` instead of `node` for running JavaScript files
- Use `bin/npm` instead of `npm` for package management
- Use `bin/run` for running the application
- These scripts execute commands inside the Docker container
- **IMPORTANT**: When using bin scripts, run them from the project root directory, NOT from the app directory

### Common Commands
All commands should be run from the project root using bin scripts:

**Development:**
- `bin/npm run start` - Start webhook server
- `bin/npm run source:watch` - Watch and process Drive folder changes
- `bin/npm run build` - Compile TypeScript to JavaScript
- `bin/npm run build:watch` - Watch mode compilation
- `bin/npm run clean` - Remove dist directory

**Testing:**
- `bin/npm run test` - Run tests in watch mode
- `bin/npm run test:run` - Run tests once
- `bin/npm run test:ui` - Run tests with UI
- `bin/npm run test:coverage` - Run tests with coverage report

**Docker:**
- `docker compose ps` - Check running containers

### Environment Configuration
Environment variables must be configured in `app/.env`:
```
IFIRMA_USERNAME=your_username
IFIRMA_INVOICE_KEY=your_invoice_key
IFIRMA_USER_KEY=your_user_key
GDRIVE_FOLDER_ID=your_folder_id
GDRIVE_PROCESSED_FOLDER_ID=optional_processed_folder_id
WEBHOOK_URL=your_ngrok_url/webhook/drive
WEBHOOK_SECRET=your_secret_key
PORT=3000
```

## Application Architecture

### Core Components
- **GDriveiFirmaWorkflow** (`app/index.ts`): Main orchestrator that coordinates webhook server, file processing, and Google Drive integration. Supports both daemon mode (continuous running) and manual mode (process once and exit).
- **FileProcessor** (`app/file-processor.ts`): Handles file processing pipeline - downloads from Google Drive, extracts invoice data from PDFs/Excel, and submits to iFirma API. Maintains processed file tracking.
- **iFirmaAPI** (`app/ifirma-api.ts`): Manages authentication and API calls to iFirma.pl for both invoices and expenses.
- **GoogleDriveClient** (`app/google-drive-client.ts`): Handles Google Drive API interactions including file listing, downloading, moving, and webhook setup.
- **WebhookServer** (`app/webhook-server.ts`): Express server with endpoints for Google Drive webhooks, manual processing triggers, and health checks.

### Main Entry Points
- `app/index.ts`: Main application entry point with daemon/manual modes
  - Daemon mode: `bin/node dist/index.js` - Continuous processing
  - Manual mode: `bin/node dist/index.js --manual` - Process once and exit
- `app/config.ts`: Central configuration management loading from environment variables
- `app/webhook-server.ts`: Express server on port 3000 with three endpoints:
  - `POST /webhook/drive` - Receives Google Drive notifications
  - `POST /manual-process` - Manually trigger file processing
  - `GET /health` - Health check and service status

### Data Flow
1. Google Drive sends webhook notification or polling detects changes
2. FileProcessor scans folder for new unprocessed files (PDF/Excel)
3. Files are downloaded to temp directory
4. Invoice data extracted using regex patterns (PDF) or cell mapping (Excel)
5. Document classified as invoice or expense based on filename/content keywords
6. Data formatted to iFirma API schema and submitted with authentication hash
7. Successfully processed files moved to processed folder (optional)
8. File IDs tracked in `processed_files.json` to prevent reprocessing

### File Processing Details
**Supported file types:** PDF, XLSX, XLS

**PDF Processing:**
- Uses `pdf-ts` library to extract text
- Regex patterns match: invoice number, issue date, sale date, client name, NIP, items
- Falls back to default item if parsing fails

**Excel Processing:**
- Reads first worksheet using `xlsx` library
- Expected structure: Row 2 contains header data (identifier, dates, client info)
- Items start from row 4 with columns: VAT rate, name, quantity, price

**Invoice vs Expense Detection:**
- Checks filename for keywords: `wydatek`, `koszty`, `rachunek`, `paragon`, `expense`
- Checks identifier for "wy" prefix
- Routes to appropriate iFirma endpoint

## iFirma API Integration

### Authentication
The authentication uses SHA1 hash (not HMAC-SHA1 as previously documented):
- Format: `SHA1(username + invoiceKey + JSON.stringify(payload))`
- Implementation in `app/ifirma-api.ts:50-52`
- Header format: `IAPIS user={username}, hmac-sha1={hash}`

### API Endpoints
- Invoices: `fakturakraj.json` - Domestic invoices
- Expenses: `wydatek.json` - Business expenses
- Base URL: `https://www.ifirma.pl/iapi/`

### Payload Structure
**Invoice payload:**
- Identyfikator, DataWystawienia, MiejsceWystawienia, DataSprzedazy
- SposobZaplaty, TerminPlatnosci
- Kontrahent: {Nazwa, NIP, Adres}
- Pozycje: [{StawkaVat, Nazwa, Ilosc, Cena}]

**Expense payload:**
- Identyfikator, DataWystawienia, DataZakupu
- Kontrahent: {Nazwa, NIP}
- Pozycje: [{StawkaVat, Nazwa, Ilosc, Cena}]

## Testing

### Test Framework
- Uses Vitest with TypeScript support
- Tests located in `app/tests/`
- Configuration in `app/vitest.config.ts`
- Coverage provider: v8

### Test Files
- `watch-drive-folder.test.ts` - Integration tests
- `watch-drive-folder.unit.test.ts` - Unit tests with mocks
- `google-drive-client.test.ts` - Drive client tests
- `setup.ts` - Test environment setup

## Dependencies
Key libraries:
- **googleapis**: Google Drive API integration
- **axios**: HTTP client for iFirma API
- **crypto-js**: SHA1 hash generation for authentication
- **pdf-ts**: PDF text extraction
- **xlsx**: Excel file processing
- **express**: Web server for webhooks
- **fs-extra**: Enhanced file system operations
- **tsx**: TypeScript execution and watch mode
- **vitest**: Testing framework with coverage