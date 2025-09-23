// test.js - Testy połączeń i funkcjonalności
const GoogleDriveClient = require('./google-drive-client');
const iFirmaAPI = require('./ifirma-api');
const FileProcessor = require('./file-processor');

async function runTests() {
  console.log('🧪 Uruchamianie testów...\n');

  // Test Google Drive connection
  console.log('1️⃣ Test połączenia z Google Drive API...');
  const driveClient = new GoogleDriveClient();

  try {
    const connected = await driveClient.initialize();
    if (connected) {
      console.log('✅ Google Drive API - połączenie OK');

      // Test listing files
      const filesData = await driveClient.listFiles();
      console.log(`📊 Znaleziono ${filesData.files.length} plików w folderze`);
    } else {
      console.log('❌ Google Drive API - błąd połączenia');
    }
  } catch (error) {
    console.log('❌ Google Drive API error:', error.message);
  }

  console.log();

  // Test iFirma API
  console.log('2️⃣ Test połączenia z iFirma API...');
  const ifirmaApi = new iFirmaAPI();

  // Test data
  const testInvoice = {
    identifier: `TEST-${Date.now()}`,
    issueDate: new Date().toISOString().split('T')[0],
    saleDate: new Date().toISOString().split('T')[0],
    clientName: 'Test Client Sp. z o.o.',
    clientNip: '1234567890',
    clientAddress: 'ul. Testowa 1, 00-001 Warszawa',
    items: [{
      Nazwa: 'Usługa testowa',
      Ilosc: 1,
      Cena: 123.45,
      StawkaVat: 23
    }]
  };

  try {
    console.log('📝 Wysyłanie testowej faktury...');
    const result = await ifirmaApi.sendInvoice(testInvoice);

    if (result.success) {
      console.log('✅ iFirma API - test wysyłania OK');
      console.log('📄 Odpowiedź:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ iFirma API - błąd wysyłania');
      console.log('📄 Błąd:', result.error);
    }
  } catch (error) {
    console.log('❌ iFirma API error:', error.message);
  }

  console.log();

  // Test file processing
  console.log('3️⃣ Test przetwarzania plików...');
  const processor = new FileProcessor();

  try {
    await processor.initialize();
    console.log('✅ FileProcessor - inicjalizacja OK');

    // Test processing existing files
    console.log('🔄 Testowanie przetwarzania istniejących plików...');
    await processor.processNewFiles();
    console.log('✅ Przetwarzanie plików - test zakończony');

  } catch (error) {
    console.log('❌ FileProcessor error:', error.message);
  }

  console.log('\n🏁 Testy zakończone');
}

runTests().catch(console.error);