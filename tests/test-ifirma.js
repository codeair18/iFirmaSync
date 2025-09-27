// test-ifirma-integration.js
import axios from 'axios';
import crypto from 'crypto-js';
import fs from 'fs-extra';
import util from 'util';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

class iFirmaIntegrationTest {
  constructor() {
    this.baseUrl = 'https://www.ifirma.pl/iapi/';
    this.username = process.env.IFIRMA_USERNAME;
    this.invoiceKey = process.env.IFIRMA_INVOICE_KEY;
    this.expenseKey = process.env.IFIRMA_EXPENSE_KEY || process.env.IFIRMA_INVOICE_KEY; // fallback to invoice key
    this.userKey = process.env.IFIRMA_USER_KEY;

    // Walidacja konfiguracji
    this.validateConfig();
  }

  validateConfig() {
    const requiredVars = ['IFIRMA_USERNAME', 'IFIRMA_INVOICE_KEY', 'IFIRMA_USER_KEY'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ Konfiguracja iFirma załadowana:');
    console.log(`   Username: ${this.username}`);
    console.log(`   Invoice Key: ${this.invoiceKey.substring(0, 8)}...`);
    console.log(`   User Key: ${this.userKey.substring(0, 8)}...`);
  }

  generateAuthHash(url, data, endpoint = '') {
    // Format: url + nazwaUsera + nazwaKlucza + requestContent
    const requestContent = JSON.stringify(data);

    // Determine key name and actual key based on endpoint
    let keyName, keyValue;
    if (endpoint.includes('zakup') || endpoint.includes('expense')) {
      keyName = 'wydatek';
      keyValue = this.expenseKey;
    } else {
      keyName = 'faktura';
      keyValue = this.invoiceKey;
    }

    const authString = `${url}${this.username}${keyName}${requestContent}`;

    // Convert hex key to WordArray for proper HMAC calculation
    const hexKey = crypto.enc.Hex.parse(keyValue);
    return crypto.HmacSHA1(authString, hexKey).toString();
  }

  async makeAPICall(endpoint, payload, method = 'POST') {
    console.log('PAYLOAD:', util.inspect(payload, false, null, true /* enable colors */))
    const url = `${this.baseUrl}${endpoint}`;
    const authHash = this.generateAuthHash(url, payload, endpoint);

    console.log(`Username: ${this.username}`);
    console.log(`🔑 Generated Auth Hash: ${authHash}`);

    const authHeader = `IAPIS user=${this.username}, hmac-sha1=${authHash}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authentication': authHeader,
      'User-Agent': 'InvoiceFlow-Test/1.0'
    };

    console.log(`🌐 API Call: ${method} ${endpoint}`);
    console.log(`📦 Payload size: ${JSON.stringify(payload).length} characters`);

    try {
      const response = await axios({
        method,
        url,
        data: payload,
        headers,
        timeout: 30000
      });

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        error: error.response?.data || error.message,
        details: {
          endpoint,
          payload: JSON.stringify(payload, null, 2),
          headers
        }
      };
    }
  }

  async runAllTests() {
    console.log('🧪 Uruchamianie testów integracji iFirma.pl...\n');

    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    try {
      // // Test 1: Ping API
      // await this.testPingAPI(results);
      //
      // // Test 2: Test autoryzacji
      // await this.testAuthentication(results);

      // // Test 3: Lista faktur
      // await this.testListInvoices(results);
      //
      // // Test 4: Tworzenie faktury testowej
      // await this.testCreateInvoice(results);
      //
      // Test 5: Tworzenie wydatku testowego
      await this.testCreateExpense(results);
      //
      // // Test 6: Test różnych formatów danych
      // await this.testDataFormats(results);
      //
      // // Test 7: Test błędów walidacji
      // await this.testValidationErrors(results);

    } catch (error) {
      console.error('\n❌ Krytyczny błąd podczas testów:', error.message);
    }

    this.printTestSummary(results);
    return results;
  }

  async testPingAPI(results) {
    console.log('1️⃣ Test dostępności API...');

    try {
      const response = await axios.get(`${this.baseUrl}ping`, {
        timeout: 10000,
        headers: { 'User-Agent': 'InvoiceFlow-Test/1.0' }
      });

      console.log(`✅ API dostępne (status: ${response.status})`);
      if (response.data) {
        console.log(`📄 Odpowiedź: ${JSON.stringify(response.data)}`);
      }

      this.addTestResult(results, 'API Ping', true, 'API odpowiada poprawnie');

    } catch (error) {
      console.log(`❌ API niedostępne: ${error.message}`);
      this.addTestResult(results, 'API Ping', false, error.message);
    }

    console.log();
  }

  async testAuthentication(results) {
    console.log('2️⃣ Test autoryzacji...');

    // Minimalna faktura do testu autoryzacji
    const testPayload = {
      Identyfikator: `AUTH_TEST_${Date.now()}`,
      DataWystawienia: new Date().toISOString().split('T')[0],
      DataSprzedazy: new Date().toISOString().split('T')[0],
      SposobZaplaty: 'Gotówka',
      Kontrahent: {
        Nazwa: 'Test Client Auth',
        NIP: '0000000000'
      },
      Pozycje: [{
        StawkaVat: 0,
        Nazwa: 'Test autoryzacji',
        Ilosc: 1,
        Cena: 0.01
      }]
    };

    const result = await this.makeAPICall('fakturakraj.json', testPayload);


    console.log(util.inspect(result, false, null, true /* enable colors */))

    if (result.success) {
      console.log('✅ Autoryzacja poprawna');
      console.log(`📄 Utworzono fakturę testową: ${testPayload.Identyfikator}`);
      this.addTestResult(results, 'Authentication', true, 'Poprawna autoryzacja i tworzenie faktury');
    } else {
      console.log('❌ Błąd autoryzacji:');
      console.log(`   Status: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);

      // Analiza błędu
      if (result.status === 401) {
        console.log('💡 Prawdopodobna przyczyna: Nieprawidłowe klucze API lub hash autoryzacji');
      } else if (result.status === 403) {
        console.log('💡 Prawdopodobna przyczyna: Brak uprawnień lub konto nieaktywne');
      }

      this.addTestResult(results, 'Authentication', false, JSON.stringify(result.error));
    }

    console.log();
  }

  async testListInvoices(results) {
    console.log('3️⃣ Test listowania faktur...');

    // Test GET endpoint (jeśli dostępny)
    try {
      const response = await axios.get(`${this.baseUrl}fakturakraj.json`, {
        headers: {
          'Authentication': `${this.username},${this.generateAuthHash(`${this.baseUrl}fakturakraj.json`, {})}`,
          'User-Agent': 'InvoiceFlow-Test/1.0'
        },
        timeout: 15000
      });

      console.log('✅ Lista faktur pobrana');
      console.log(`📊 Znaleziono ${response.data?.length || 0} faktur`);
      this.addTestResult(results, 'List Invoices', true, 'Lista faktur pobrana poprawnie');

    } catch (error) {
      if (error.response?.status === 405) {
        console.log('ℹ️  Endpoint listowania nie jest dostępny (Method Not Allowed)');
        this.addTestResult(results, 'List Invoices', true, 'Endpoint nie obsługuje GET (normalne)');
      } else {
        console.log(`⚠️  Błąd listowania faktur: ${error.message}`);
        this.addTestResult(results, 'List Invoices', false, error.message);
      }
    }

    console.log();
  }

  async testCreateInvoice(results) {
    console.log('4️⃣ Test tworzenia faktury sprzedaży...');

    const invoiceData = {
      Identyfikator: `TEST_INV_${Date.now()}`,
      DataWystawienia: new Date().toISOString().split('T')[0],
      DataSprzedazy: new Date().toISOString().split('T')[0],
      MiejsceWystawienia: 'Warszawa',
      SposobZaplaty: 'Przelew',
      TerminPlatnosci: this.getDateInDays(14),
      Kontrahent: {
        Nazwa: 'Test Client Sp. z o.o.',
        NIP: '1234567890',
        Adres: 'ul. Testowa 123, 00-001 Warszawa'
      },
      Pozycje: [
        {
          StawkaVat: 23,
          Nazwa: 'Usługa programistyczna',
          Ilosc: 10,
          Cena: 150.00
        },
        {
          StawkaVat: 8,
          Nazwa: 'Materiały biurowe',
          Ilosc: 1,
          Cena: 50.00
        }
      ]
    };

    const result = await this.makeAPICall('fakturakraj.json', invoiceData);

    if (result.success) {
      console.log('✅ Faktura utworzona pomyślnie');
      console.log(`📄 ID faktury: ${invoiceData.Identyfikator}`);
      console.log(`💰 Wartość brutto: ${this.calculateInvoiceTotal(invoiceData.Pozycje)} PLN`);

      if (result.data) {
        console.log(`📋 Odpowiedź API:`, JSON.stringify(result.data, null, 2));
      }

      this.addTestResult(results, 'Create Invoice', true, `Faktura ${invoiceData.Identyfikator} utworzona`);
    } else {
      console.log('❌ Błąd tworzenia faktury:');
      console.log(`   Status: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
      this.addTestResult(results, 'Create Invoice', false, JSON.stringify(result.error));
    }

    console.log();
  }

  async testCreateExpense(results) {
    console.log('5️⃣ Test tworzenia wydatku...');

    const expenseData = {
      "NumerFaktury": "13/2014",
      "DataWystawienia": "2025-09-09",
      "DataWplywu": "2025-09-09",
      "TerminPlatnosci": "2025-09-09",
      "NazwaWydatku": "Wygenerowany wydatek testowy",
      "KwotaNetto23": 100.00,
      "KwotaNetto08": 0.00,
      "KwotaNetto05": 0.00,
      "KwotaNetto00": 0.00,
      "KwotaNettoZw": 0.00,
      "RodzajSprzedazy": "OP",
      "KwotaVat23": 23.00,
      "KwotaVat08": null,
      "KwotaVat05": null,
      "Kontrahent":
        {
          "Nazwa": "Adam Wójcik",
          "Identyfikator": null,
          "PrefiksUE": null,
          "NIP": null,
          "OsobaFizyczna": true,
          "Ulica": "Pomorska 74",
          "KodPocztowy": "12-642",
          "Kraj": "Polska",
          "Miejscowosc": "Wrocław",
          "Email": "mail@email.pl",
          "Telefon": "222111896"
        }
    };

    const result = await this.makeAPICall('zakuptowaruvat.json', expenseData);

    console.log(util.inspect(result, false, null, true /* enable colors */))

    if (result.success) {
      console.log('✅ Wydatek utworzony pomyślnie');
      console.log(`📄 Numer faktury: ${expenseData.NumerFaktury}`);
      console.log(`💸 Wartość netto 23%: ${expenseData.KwotaNetto23} PLN`);
      this.addTestResult(results, 'Create Expense', true, `Wydatek ${expenseData.NumerFaktury} utworzony`);
    } else {
      console.log('❌ Błąd tworzenia wydatku:');
      console.log(`   Status: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.error, null, 2)}`);
      this.addTestResult(results, 'Create Expense', false, JSON.stringify(result.error));
    }

    console.log();
  }

  async testDataFormats(results) {
    console.log('6️⃣ Test różnych formatów danych...');

    // Test z różnymi formatami dat
    const dateFormats = [
      new Date().toISOString().split('T')[0], // YYYY-MM-DD
      new Date().toLocaleDateString('pl-PL'),  // DD.MM.YYYY
    ];

    let passed = 0;
    let total = dateFormats.length;

    for (let i = 0; i < dateFormats.length; i++) {
      const dateFormat = dateFormats[i];
      console.log(`   Test ${i + 1}: Format daty "${dateFormat}"`);

      const testData = {
        Identyfikator: `DATE_TEST_${i}_${Date.now()}`,
        DataWystawienia: dateFormat,
        DataSprzedazy: dateFormat,
        SposobZaplaty: 'Gotówka',
        Kontrahent: {
          Nazwa: `Test Date Format ${i + 1}`,
          NIP: '0000000000'
        },
        Pozycje: [{
          StawkaVat: 0,
          Nazwa: 'Test formatu daty',
          Ilosc: 1,
          Cena: 0.01
        }]
      };

      const result = await this.makeAPICall('fakturakraj.json', testData);

      if (result.success) {
        console.log(`   ✅ Format "${dateFormat}" działa`);
        passed++;
      } else {
        console.log(`   ❌ Format "${dateFormat}" nie działa: ${JSON.stringify(result.error)}`);
      }
    }

    const success = passed === total;
    this.addTestResult(results, 'Data Formats', success, `${passed}/${total} formatów dat działa`);
    console.log();
  }

  async testValidationErrors(results) {
    console.log('7️⃣ Test obsługi błędów walidacji...');

    // Test z nieprawidłowymi danymi
    const invalidData = {
      Identyfikator: '', // Pusty identyfikator
      DataWystawienia: 'invalid-date',
      SposobZaplaty: 'Przelew',
      Kontrahent: {
        Nazwa: '', // Pusta nazwa
        NIP: '123' // Nieprawidłowy NIP
      },
      Pozycje: [] // Brak pozycji
    };

    const result = await this.makeAPICall('fakturakraj.json', invalidData);

    if (!result.success) {
      console.log('✅ API poprawnie odrzuca nieprawidłowe dane');
      console.log(`   Status: ${result.status}`);
      console.log(`   Błędy: ${JSON.stringify(result.error, null, 2)}`);
      this.addTestResult(results, 'Validation Errors', true, 'API poprawnie waliduje dane');
    } else {
      console.log('⚠️  API przyjęło nieprawidłowe dane (może być problematyczne)');
      this.addTestResult(results, 'Validation Errors', false, 'API nie waliduje danych');
    }

    console.log();
  }

  // Pomocnicze metody
  getDateInDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  calculateInvoiceTotal(positions) {
    return positions.reduce((total, pos) => {
      const netValue = pos.Ilosc * pos.Cena;
      const vatValue = netValue * (pos.StawkaVat / 100);
      return total + netValue + vatValue;
    }, 0).toFixed(2);
  }

  addTestResult(results, testName, passed, message) {
    results.tests.push({
      name: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });

    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  printTestSummary(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PODSUMOWANIE TESTÓW iFirma.pl');
    console.log('='.repeat(50));

    console.log(`✅ Testy przeszły: ${results.passed}`);
    console.log(`❌ Testy nie przeszły: ${results.failed}`);
    console.log(`📈 Sukces: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

    console.log('\n📋 Szczegóły testów:');
    results.tests.forEach((test, index) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${test.name}: ${test.message}`);
    });

    // Zapisz raport do pliku
    this.saveTestReport(results);

    if (results.failed === 0) {
      console.log('\n🎉 Wszystkie testy przeszły pomyślnie! iFirma API działa poprawnie.');
    } else {
      console.log('\n⚠️  Niektóre testy nie przeszły. Sprawdź konfigurację i klucze API.');
    }
  }

  async saveTestReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: results.passed,
        failed: results.failed,
        successRate: Math.round((results.passed / (results.passed + results.failed)) * 100)
      },
      tests: results.tests,
      configuration: {
        username: this.username,
        baseUrl: this.baseUrl,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    try {
      await fs.ensureDir('./test-reports');
      const filename = `ifirma-test-report-${Date.now()}.json`;
      const filepath = `./test-reports/${filename}`;

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Raport zapisany: ${filepath}`);

    } catch (error) {
      console.log(`⚠️  Nie udało się zapisać raportu: ${error.message}`);
    }
  }

  // Metoda do testowania konkretnego endpointu
  async testCustomEndpoint(endpoint, payload) {
    console.log(`\n🧪 Test custom endpoint: ${endpoint}`);

    const result = await this.makeAPICall(endpoint, payload);

    console.log('Rezultat:');
    console.log(`   Status: ${result.status}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Response: ${JSON.stringify(result.data || result.error, null, 2)}`);

    return result;
  }
}

// Funkcja main
async function main() {
  // Sprawdź wymagane pliki
  if (!fs.existsSync('./.env')) {
    console.error('❌ Brak pliku .env');
    console.log('📋 Utwórz plik .env z kluczami iFirma:');
    console.log('   IFIRMA_USERNAME=your_username');
    console.log('   IFIRMA_INVOICE_KEY=your_invoice_key');
    console.log('   IFIRMA_USER_KEY=your_user_key');
    process.exit(1);
  }

  try {
    const tester = new iFirmaIntegrationTest();
    const results = await tester.runAllTests();

    // Exit code na podstawie wyników
    const exitCode = results.failed > 0 ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Krytyczny błąd:', error.message);
    process.exit(1);
  }
}

// Obsługa błędów
process.on('unhandledRejection', (error) => {
  console.error('❌ Nieobsłużony błąd:', error.message);
  process.exit(1);
});

export default iFirmaIntegrationTest;

// Uruchom testy tylko jeśli plik jest wykonywany bezpośrednio
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}