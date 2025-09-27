// test-google-drive.js
import { google } from 'googleapis';
import fs from 'fs-extra';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

class GoogleDriveTest {
  constructor() {
    this.folderId = process.env.GDRIVE_FOLDER_ID;

    // Inicjalizacja autoryzacji
    this.auth = new google.auth.GoogleAuth({
      keyFile: './service-account-key.json',
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });

    // Upewnij się że folder downloads istnieje
    fs.ensureDirSync('./downloads');
  }

  async runAllTests() {
    console.log('🧪 Uruchamianie testów Google Drive...\n');

    try {
      await this.testAuthentication();
      await this.testListFiles();
      await this.testDownloadFile();
      await this.testFileOperations();

      console.log('\n🎉 Wszystkie testy przeszły pomyślnie!');

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async testAuthentication() {
    console.log('1️⃣ Test autoryzacji...');

    try {
      const authClient = await this.auth.getClient();
      console.log('✅ Service Account authenticated');

      // Sprawdź email Service Account
      const keyData = JSON.parse(fs.readFileSync('./service-account-key.json', 'utf8'));
      console.log(`📧 Service Account email: ${keyData.client_email}`);

    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async testListFiles() {
    console.log('\n2️⃣ Test listowania plików...');

    if (!this.folderId) {
      throw new Error('GDRIVE_FOLDER_ID not set in .env file');
    }

    try {
      // Lista plików w folderze
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
        pageSize: 50
      });

      const files = response.data.files;
      console.log(`✅ Znaleziono ${files.length} plików w folderze`);

      if (files.length > 0) {
        console.log('\n📁 Lista plików:');
        files.forEach((file, index) => {
          const size = file.size ? `${Math.round(file.size / 1024)} KB` : 'N/A';
          const modified = new Date(file.modifiedTime).toLocaleString();
          console.log(`   ${index + 1}. ${file.name}`);
          console.log(`      ID: ${file.id}`);
          console.log(`      Type: ${file.mimeType}`);
          console.log(`      Size: ${size}`);
          console.log(`      Modified: ${modified}\n`);
        });

        // Zapisz pierwszy plik do dalszych testów
        this.testFile = files[0];
      } else {
        console.log('⚠️  Brak plików w folderze - dodaj jakiś plik do testowania pobierania');
      }

    } catch (error) {
      if (error.message.includes('403')) {
        throw new Error(`Access denied to folder. Make sure folder ${this.folderId} is shared with Service Account`);
      }
      throw error;
    }
  }

  async testDownloadFile() {
    console.log('\n3️⃣ Test pobierania pliku...');

    if (!this.testFile) {
      console.log('⚠️  Pominięto - brak plików do pobrania');
      return;
    }

    try {
      const fileName = this.testFile.name;
      const filePath = path.join('./downloads', `test_${Date.now()}_${fileName}`);

      console.log(`📥 Pobieranie pliku: ${fileName}`);

      // Pobierz plik
      const response = await this.drive.files.get({
        fileId: this.testFile.id,
        alt: 'media'
      }, { responseType: 'stream' });

      // Zapisz do pliku
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      // Poczekaj aż pobieranie się zakończy
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Sprawdź czy plik został pobrany
      const stats = fs.statSync(filePath);
      console.log(`✅ Plik pobrany: ${path.basename(filePath)} (${stats.size} bytes)`);

      // Usuń testowy plik
      fs.unlinkSync(filePath);
      console.log('🗑️  Testowy plik usunięty');

    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async testFileOperations() {
    console.log('\n4️⃣ Test operacji na plikach...');

    try {
      // Test wyszukiwania plików
      console.log('🔍 Test wyszukiwania plików PDF...');
      const pdfFiles = await this.searchFiles("mimeType='application/pdf'");
      console.log(`✅ Znaleziono ${pdfFiles.length} plików PDF`);

      // Test wyszukiwania plików Excel
      console.log('🔍 Test wyszukiwania plików Excel...');
      const excelFiles = await this.searchFiles("mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel'");
      console.log(`✅ Znaleziono ${excelFiles.length} plików Excel`);

      // Test tworzenia folderu (opcjonalnie)
      console.log('📁 Test tworzenia folderu...');
      const testFolder = await this.createTestFolder();
      console.log(`✅ Utworzono folder testowy: ${testFolder.name} (${testFolder.id})`);

      // Test usuwania folderu
      console.log('🗑️  Test usuwania folderu...');
      await this.deleteFile(testFolder.id);
      console.log('✅ Folder testowy usunięty');

    } catch (error) {
      throw new Error(`File operations failed: ${error.message}`);
    }
  }

  async searchFiles(query) {
    const fullQuery = `${query} and '${this.folderId}' in parents and trashed=false`;

    const response = await this.drive.files.list({
      q: fullQuery,
      fields: 'files(id, name, mimeType)'
    });

    return response.data.files;
  }

  async createTestFolder() {
    const folderName = `test_folder_${Date.now()}`;

    const response = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId]
      }
    });

    return response.data;
  }

  async deleteFile(fileId) {
    await this.drive.files.delete({
      fileId: fileId
    });
  }

  async downloadSpecificFile(fileName) {
    console.log(`\n📥 Pobieranie konkretnego pliku: ${fileName}`);

    try {
      // Znajdź plik po nazwie
      const response = await this.drive.files.list({
        q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size)'
      });

      if (response.data.files.length === 0) {
        throw new Error(`Plik '${fileName}' nie został znaleziony`);
      }

      const file = response.data.files[0];
      console.log(`✅ Znaleziono plik: ${file.name} (${file.id})`);

      // Pobierz plik
      const downloadPath = path.join('./downloads', fileName);
      const fileResponse = await this.drive.files.get({
        fileId: file.id,
        alt: 'media'
      }, { responseType: 'stream' });

      const writer = fs.createWriteStream(downloadPath);
      fileResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`✅ Plik pobrany do: ${downloadPath}`);
      return downloadPath;

    } catch (error) {
      throw new Error(`Nie udało się pobrać pliku '${fileName}': ${error.message}`);
    }
  }

  // Pomocnicza metoda do sprawdzenia czy plik to obsługiwany typ faktury
  isSupportedInvoiceFile(file) {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    const supportedExtensions = ['.pdf', '.xlsx', '.xls'];
    const fileExtension = path.extname(file.name).toLowerCase();

    return supportedTypes.includes(file.mimeType) || supportedExtensions.includes(fileExtension);
  }

  async findInvoiceFiles() {
    console.log('\n💼 Szukanie plików faktur...');

    try {
      const allFiles = await this.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)'
      });

      const invoiceFiles = allFiles.data.files.filter(file =>
        this.isSupportedInvoiceFile(file)
      );

      console.log(`✅ Znaleziono ${invoiceFiles.length} plików faktur:`);

      invoiceFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name} (${file.mimeType})`);
      });

      return invoiceFiles;

    } catch (error) {
      throw new Error(`Błąd wyszukiwania faktur: ${error.message}`);
    }
  }
}

// Uruchomienie testów
async function main() {
  // Sprawdź wymagane pliki
  if (!fs.existsSync('./service-account-key.json')) {
    console.error('❌ Brak pliku service-account-key.json');
    console.log('📋 Pobierz klucz Service Account z Google Cloud Console');
    process.exit(1);
  }

  if (!fs.existsSync('./.env')) {
    console.error('❌ Brak pliku .env');
    console.log('📋 Utwórz plik .env z GDRIVE_FOLDER_ID');
    process.exit(1);
  }

  const tester = new GoogleDriveTest();

  // Uruchom wszystkie testy
  await tester.runAllTests();

  // Opcjonalnie: pobierz konkretny plik
  // await tester.downloadSpecificFile('faktura.pdf');

  // Opcjonalnie: znajdź wszystkie pliki faktur
  await tester.findInvoiceFiles();
}

// Obsługa błędów
process.on('unhandledRejection', (error) => {
  console.error('❌ Nieobsłużony błąd:', error.message);
  process.exit(1);
});

export default GoogleDriveTest;

// Uruchom testy tylko jeśli plik jest wykonywany bezpośrednio
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}