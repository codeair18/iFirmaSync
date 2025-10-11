# iFirmaSync

Automatyczna synchronizacja faktur z Google Drive do systemu księgowego iFirma.pl.

## Opis

iFirmaSync to aplikacja Node.js, która monitoruje folder Google Drive w poszukiwaniu plików faktur (formaty PDF i Excel), wyodrębnia dane faktur i automatycznie tworzy wpisy w systemie księgowym iFirma.pl.

## Funkcje

- **Automatyczne monitorowanie**: Obserwuje folder Google Drive w poszukiwaniu nowych plików faktur
- **Obsługa wielu formatów**: Przetwarza pliki PDF i Excel
- **Wyodrębnianie danych**: Automatyczne wyodrębnianie informacji z faktur
- **Integracja z iFirma**: Automatyczne przesyłanie faktur do iFirma.pl przez API
- **Obsługa webhooków**: Odbiera powiadomienia o zmianach w Google Drive w czasie rzeczywistym
- **Oparte na Docker**: Spójne środowisko deweloperskie

## Wymagania

- Docker i Docker Compose
- Projekt Google Cloud z włączonym API Google Drive
- Poświadczenia konta usługi (service account) dla Google Drive
- Konto iFirma.pl z dostępem do API
- Token ngrok (dla webhooków Google Drive)

## Instalacja

### 1. Sklonuj repozytorium

```bash
git clone <adres-repozytorium>
cd iFirmaSync
```

### 2. Skonfiguruj zmienne środowiskowe

Utwórz plik `app/.env` z następującymi zmiennymi:

```env
IFIRMA_USERNAME=twoja_nazwa_uzytkownika
IFIRMA_INVOICE_KEY=twoj_klucz_faktur
IFIRMA_USER_KEY=twoj_klucz_uzytkownika
GDRIVE_FOLDER_ID=id_folderu_drive
```

### 3. Konto usługi Google

Umieść poświadczenia konta usługi Google w:
```
app/service-account-key.json
```

### 4. Konfiguracja ngrok

Utwórz plik `.env` w głównym katalogu projektu z tokenem ngrok:
```env
NGROK_AUTHTOKEN=twoj_token_ngrok
```

Token możesz uzyskać po rejestracji na [ngrok.com](https://ngrok.com).

### 5. Zbuduj i uruchom

```bash
docker-compose up -d
```

## Użytkowanie

### Uruchamianie aplikacji

Aplikacja obsługuje dwa tryby:

**Tryb demona** (ciągłe monitorowanie):
```bash
bin/node app/index.js
```

**Tryb ręczny** (jednorazowe przetwarzanie):
```bash
bin/node app/index.js --manual
```

### Polecenia deweloperskie

**WAŻNE**: Zawsze używaj skryptów `bin/` z głównego katalogu projektu:

```bash
# Instalacja zależności
bin/npm install

# Uruchamianie skryptów Node.js
bin/node app/index.js

# Uruchamianie testów
bin/node app/tests/test-ifirma.js
```

Te skrypty wykonują polecenia wewnątrz kontenera Docker dla spójności.

### Panel monitorowania ngrok

Po uruchomieniu aplikacji dostępny jest panel ngrok do weryfikacji tunelu:
- **URL**: http://localhost:4040
- **Funkcje**:
  - Podgląd publicznego URL tunelu
  - Status połączenia
  - Live monitoring requestów HTTP
  - Historia połączeń
  - Szczegóły zapytań i odpowiedzi

Panel pozwala na debugowanie webhooków Google Drive i weryfikację komunikacji z zewnętrznymi serwisami.

## Architektura

### Główne komponenty

- **FileProcessor**: Monitoruje i przetwarza pliki z Google Drive
- **ifirmaApi**: Obsługuje uwierzytelnianie API iFirma.pl i przesyłanie danych
- **GoogleDriveClient**: Zarządza interakcjami z API Google Drive
- **WebhookServer**: Serwer Express do odbierania powiadomień o zmianach w Google Drive

### Przepływ danych

1. Monitorowanie folderu Google Drive w poszukiwaniu nowych plików faktur
2. Pobieranie i przetwarzanie plików (parsowanie PDF/Excel)
3. Wyodrębnianie danych faktur i formatowanie dla API iFirma
4. Przesyłanie do iFirma.pl
5. Przenoszenie przetworzonych plików do wyznaczonego folderu

## Konfiguracja

Konfiguracja jest scentralizowana w pliku `app/config.ts`:

- ID folderów Google Drive
- Poświadczenia API iFirma
- Ścieżki do kont usług
- Reguły przetwarzania

## Integracja API

### API iFirma.pl

- **URL bazowy**: `https://www.ifirma.pl/iapi/`
- **Uwierzytelnianie**: Hash oparty na HMAC-SHA1
- **Endpointy**:
  - Faktury: `fakturakraj.json`
  - Wydatki: `zakuptowaruvat.json`

### API Google Drive

Używa uwierzytelniania konta usługi z API Google Drive v3 do:
- Monitorowania plików
- Pobierania plików
- Organizacji plików

## Rozwój

### Środowisko Docker

- **Kontener aplikacji**: Node.js LTS Alpine
- **Port deweloperski**: 3000
- **Kod źródłowy zamontowany w**: `/usr/src/app`
- **Kontener ngrok**:
  - Tworzy publiczny tunel do lokalnej aplikacji
  - Port panelu monitorowania: 4040
  - Umożliwia odbieranie webhooków Google Drive
  - Automatycznie łączy się z kontenerem aplikacji przez sieć Docker

### Główne zależności

- `googleapis` - Integracja z API Google Drive
- `axios` - Klient HTTP dla API iFirma
- `crypto-js` - Generowanie hashu uwierzytelniającego
- `chokidar` - Monitorowanie systemu plików
- `pdf-parse` - Wyodrębnianie tekstu z PDF
- `xlsx` - Przetwarzanie plików Excel
- `express` - Serwer webhooków

## Rozwiązywanie problemów

### Błędy uwierzytelniania

Upewnij się, że poświadczenia API iFirma są prawidłowe w pliku `app/.env` i że generowanie hashu następuje według formatu:
```
url + username + keyName + requestContent
```

### Dostęp do Google Drive

Sprawdź, czy konto usługi ma przyznany dostęp do monitorowanego folderu Google Drive.

### Problemy z ngrok

Jeśli ngrok nie działa poprawnie:
1. Sprawdź, czy token `NGROK_AUTHTOKEN` jest ustawiony w pliku `.env` w głównym katalogu projektu
2. Zweryfikuj token na http://localhost:4040 - powinien pokazać aktywny tunel
3. Sprawdź logi kontenera: `docker-compose logs ngrok`
4. Upewnij się, że token jest prawidłowy na [ngrok.com](https://ngrok.com)

## Współpraca

Pull requests są mile widziane. Proszę otworzyć issue w celu omówienia zmian przed ich wprowadzeniem.