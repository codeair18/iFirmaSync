// setup.js - Automatyczna konfiguracja
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('🔧 Google Drive → iFirma Workflow Setup');
  console.log('=====================================\n');

  // Create necessary directories
  await fs.ensureDir('./temp');
  await fs.ensureDir('./logs');

  console.log('📁 Foldery utworzone: ./temp, ./logs\n');

  // Check for service account key
  const keyPath = './service-account-key.json';
  if (!await fs.pathExists(keyPath)) {
    console.log('❌ Nie znaleziono pliku service-account-key.json');
    console.log('📋 Instrukcje:');
    console.log('1. Idź do https://console.cloud.google.com/');
    console.log('2. Utwórz nowy projekt lub wybierz istniejący');
    console.log('3. Włącz Google Drive API');
    console.log('4. Utwórz Service Account');
    console.log('5. Pobierz klucz JSON i zapisz jako service-account-key.json');
    console.log('6. Uruchom setup ponownie\n');

    const continueSetup = await question('Czy chcesz kontynuować bez klucza? (y/N): ');
    if (continueSetup.toLowerCase() !== 'y') {
      rl.close();
      return;
    }
  } else {
    console.log('✅ Klucz Service Account znaleziony\n');
  }

  // Environment variables setup
  const envPath = './.env';
  let envExists = await fs.pathExists(envPath);

  if (!envExists || await question('Plik .env istnieje. Chcesz go nadpisać? (y/N): ') === 'y') {
    console.log('\n📝 Konfiguracja zmiennych środowiskowych:');

    const gdriveFolder = await question('ID folderu Google Drive do monitorowania: ');
    const gdriveProcessed = await question('ID folderu dla przetworzonych plików (opcjonalnie): ');
    const ifirmaUsername = await question('iFirma username: ');
    const ifirmaInvoiceKey = await question('iFirma invoice key: ');
    const ifirmaUserKey = await question('iFirma user key: ');
    const webhookUrl = await question('Webhook URL (https://your-domain.com/webhook/drive): ');
    const webhookSecret = await question('Webhook secret key: ');
    const port = await question('Port serwera (3000): ') || '3000';

    const envContent = `# Google Drive API
GDRIVE_FOLDER_ID=${gdriveFolder}
GDRIVE_PROCESSED_FOLDER_ID=${gdriveProcessed}

# iFirma API  
IFIRMA_USERNAME=${ifirmaUsername}
IFIRMA_INVOICE_KEY=${ifirmaInvoiceKey}
IFIRMA_USER_KEY=${ifirmaUserKey}

# Webhook
WEBHOOK_URL=${webhookUrl}
WEBHOOK_SECRET=${webhookSecret}

# Server
PORT=${port}
NODE_ENV=development
`;

    await fs.writeFile(envPath, envContent);
    console.log('✅ Plik .env utworzony\n');
  }

  // Create processed files tracker
  if (!await fs.pathExists('./processed_files.json')) {
    await fs.writeFile('./processed_files.json', '[]');
    console.log('✅ Utworzono plik processed_files.json\n');
  }

  console.log('🎉 Setup zakończony pomyślnie!');
  console.log('\n📋 Następne kroki:');
  console.log('1. Upewnij się, że service-account-key.json jest w głównym folderze');
  console.log('2. Udostępnij folder Google Drive dla email z Service Account');
  console.log('3. Uruchom: npm start');
  console.log('4. Testuj: npm run manual');

  rl.close();
}

setup().catch(console.error);