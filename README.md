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

### 4. Zbuduj i uruchom

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

- Kontener: Node.js LTS Alpine
- Port deweloperski: 3000
- Kod źródłowy zamontowany w: `/usr/src/app`

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


## Współpraca

Pull requests są mile widziane. Proszę otworzyć issue w celu omówienia zmian przed ich wprowadzeniem.