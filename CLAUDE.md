# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
iFirmaSync is a Node.js application that synchronizes invoice files from Google Drive to the iFirma.pl accounting system. The application processes PDF and Excel files, extracts invoice data, and automatically creates entries in iFirma.

## Development Environment

### Docker Setup
This project uses Docker for development consistency:
- Main container runs Node.js LTS Alpine
- Development port: 3000
- Uses Docker Compose for orchestration
- Source code mounted at `/usr/src/app`

### Custom Bin Scripts
**IMPORTANT**: Always use the project's bin scripts instead of direct Node.js commands:
- Use `bin/node` instead of `node` for running JavaScript files
- Use `bin/npm` instead of `npm` for package management
- These scripts execute commands inside the Docker container
- **IMPORTANT**: When using bin scripts, run them from the project root directory, NOT from the app directory

### Test Requirements
Environment variables must be configured in `app/.env`:
```
IFIRMA_USERNAME=your_username
IFIRMA_INVOICE_KEY=your_invoice_key
IFIRMA_USER_KEY=your_user_key
GDRIVE_FOLDER_ID=your_folder_id
```

## Application Architecture

### Core Components
- **FileProcessor**: Handles Google Drive file monitoring and processing
- **ifirmaApi**: Manages authentication and data submission to iFirma.pl
- **GoogleDriveClient**: Handles Google Drive API interactions
- **WebhookServer**: Receives Google Drive change notifications

### Main Entry Points
- `app/index.js`: Main application entry point with daemon/manual modes
- `app/config.ts`: Central configuration management
- `app/webhook-server.ts`: Express server for webhooks

### Data Flow
1. Monitor Google Drive folder for new invoice files
2. Process files (PDF parsing, Excel reading)
3. Extract invoice data and format for iFirma
4. Submit to iFirma.pl via API
5. Move processed files to separate folder

## iFirma API Integration

### Authentication Fix
The hash generation for iFirma API authentication has been corrected in `app/tests/test-ifirma.js:34-54`:
- Uses proper HMAC-SHA1 implementation with crypto-js
- Hex key parsing: `crypto.enc.Hex.parse(this.invoiceKey)`
- Correct format: `url + username + nazwaKlucza + requestContent`
- Different keys for invoices vs expenses (faktura/wydatek)

### API Endpoints
- Invoices: `fakturakraj.json`
- Expenses: `zakuptowaruvat.json`
- Base URL: `https://www.ifirma.pl/iapi/`

## Dependencies
Key libraries used:
- `googleapis`: Google Drive API integration
- `axios`: HTTP client for iFirma API
- `crypto-js`: Hash generation for authentication
- `chokidar`: File system monitoring
- `pdf-parse`: PDF text extraction
- `xlsx`: Excel file processing
- `express`: Web server for webhooks