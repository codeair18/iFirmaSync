# iFirmaSync

Aplikacja Node.js/TypeScript do automatycznej synchronizacji faktur z Google Drive do systemu księgowego iFirma.pl.

## Spis treści
- [Wymagania](#wymagania)
- [Konfiguracja](#konfiguracja)
  - [1. Konfiguracja folderów w Google Drive](#1-konfiguracja-folderów-w-google-drive)
  - [2. Konfiguracja Google Cloud Platform](#2-konfiguracja-google-cloud-platform)
  - [3. Pobranie danych dostępowych z iFirma](#3-pobranie-danych-dostępowych-z-ifirma)
  - [4. Konfiguracja tunelu i webhooków](#4-konfiguracja-tunelu-i-webhooków)
- [Instalacja](#instalacja)
- [Uruchomienie](#uruchomienie)
- [Użytkowanie](#użytkowanie)

## Wymagania

- Docker i Docker Compose
- Konto Google Cloud Platform
- Konto w serwisie iFirma.pl z dostępem do API

## Konfiguracja

### 1. Konfiguracja folderów w Google Drive

1. Zaloguj się do Google Drive (https://drive.google.com)

2. Utwórz trzy foldery:
   - **Folder źródłowy** - do którego będą dodawane nowe faktury
   - **Folder docelowy** - folder roboczy aplikacji
   - **Folder przetworzonych** - gdzie będą przenoszone przetworzone faktury

3. Pobierz ID każdego folderu:
   - Otwórz folder w przeglądarce
   - Skopiuj ID z adresu URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`
   - ID folderu to ciąg znaków po `/folders/`

4. Zapisz ID folderów - będą potrzebne w pliku `.env`

### 2. Konfiguracja Google Cloud Platform

#### Utworzenie projektu

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Kliknij **Wybierz projekt** → **Nowy projekt**
3. Nadaj nazwę projektowi (np. "iFirmaSync")
4. Kliknij **Utwórz**

#### Włączenie Google Drive API

1. W projekcie przejdź do **API i usługi** → **Biblioteka**
2. Wyszukaj "Google Drive API"
3. Kliknij **Włącz**

#### Utworzenie konta usługi (Service Account)

1. Przejdź do **API i usługi** → **Dane logowania**
2. Kliknij **Utwórz dane logowania** → **Konto usługi**
3. Wypełnij formularz:
   - **Nazwa konta usługi**: np. "ifirma-sync-service"
   - **Opis**: "Konto usługi do synchronizacji faktur"
4. Kliknij **Utwórz i kontynuuj**
5. W sekcji "Rola" wybierz **Projekt** → **Przeglądający** (lub pomiń ten krok)
6. Kliknij **Kontynuuj** → **Gotowe**

#### Utworzenie klucza JSON

1. Znajdź utworzone konto usługi na liście
2. Kliknij na adres e-mail konta usługi
3. Przejdź do zakładki **Klucze**
4. Kliknij **Dodaj klucz** → **Utwórz nowy klucz**
5. Wybierz typ **JSON**
6. Kliknij **Utwórz** - klucz zostanie pobrany automatycznie
7. Zapisz plik jako `app/service-account-key.json`

#### Udostępnienie folderów Google Drive dla konta usługi

1. Otwórz plik `app/service-account-key.json`
2. Skopiuj wartość pola `client_email` (np. `ifirma-sync-service@projekt-123456.iam.gserviceaccount.com`)
3. W Google Drive, dla każdego z trzech utworzonych folderów:
   - Kliknij prawym przyciskiem na folder → **Udostępnij**
   - Wklej adres e-mail konta usługi
   - Ustaw uprawnienia na **Edytor**
   - Kliknij **Udostępnij**

### 3. Pobranie danych dostępowych z iFirma

1. Zaloguj się do serwisu [iFirma.pl](https://www.ifirma.pl/)

2. Przejdź do **Ustawienia** → **Integracja API**

3. Zapisz następujące dane:
   - **Nazwa użytkownika** (adres e-mail)
   - **Klucz użytkownika** (USER KEY)
   - **Klucz faktur** (INVOICE KEY)
   - **Klucz wydatków** (EXPENSE KEY)

4. Jeśli nie masz włączonego API:
   - Skontaktuj się z obsługą iFirma w celu aktywacji dostępu do API
   - API jest dostępne w wybranych pakietach usług

### 4. Konfiguracja tunelu i webhooków

Aplikacja wymaga publicznego URL do odbierania powiadomień webhook z Google Drive.

#### Konfiguracja pliku `.env` (katalog główny projektu)

Utwórz plik `.env` w katalogu głównym projektu:

```env
# Local Tunnel (localtunnel)
TUNNEL_SUBDOMAIN=twoja-unikalna-nazwa
```

Wybierz unikalną nazwę dla swojego tunelu (np. `ifirma-sync-jan-kowalski`).

#### Konfiguracja pliku `app/.env`

Utwórz plik `app/.env`:

```env
# Google Drive API
GDRIVE_SOURCE_FOLDER_ID={ID_FOLDERU_ŹRÓDŁOWEGO}
GDRIVE_FOLDER_ID={ID_FOLDERU_DOCELOWEGO}
GDRIVE_PROCESSED_FOLDER_ID={ID_FOLDERU_PRZETWORZONYCH}

# iFirma API
IFIRMA_USERNAME={TWÓJ_EMAIL}
IFIRMA_INVOICE_KEY={KLUCZ_FAKTUR}
IFIRMA_EXPENSE_KEY={KLUCZ_WYDATKÓW}
IFIRMA_USER_KEY={KLUCZ_UŻYTKOWNIKA}

# Webhook
WEBHOOK_URL=https://{TUNNEL_SUBDOMAIN}.loca.lt/webhook/drive
WEBHOOK_SECRET={LOSOWY_CIĄG_ZNAKÓW}

# Server
PORT=3000
NODE_ENV=production
```

Gdzie:
- `{ID_FOLDERU_*}` - ID folderów z kroku 1
- `{TWÓJ_EMAIL}` - adres e-mail z iFirma
- `{KLUCZ_*}` - klucze API z iFirma z kroku 3
- `{TUNNEL_SUBDOMAIN}` - taka sama nazwa jak w `.env`
- `{LOSOWY_CIĄG_ZNAKÓW}` - wygeneruj bezpieczny losowy ciąg (np. 32 znaki)

**Przykład generowania losowego ciągu:**
```bash
openssl rand -hex 32
```

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone <repository-url>
cd iFirmaSync
```

2. Upewnij się, że pliki konfiguracyjne są na miejscu:
   - `.env` w katalogu głównym
   - `app/.env` z konfiguracją
   - `app/service-account-key.json` z Google Cloud

3. Uruchom kontenery Docker:
```bash
docker compose up -d
```

4. Zainstaluj zależności:
```bash
bin/npm install
```

5. Zbuduj projekt:
```bash
bin/npm run build
```

## Uruchomienie

### Tryb ciągły (daemon)

Uruchomienie serwera webhook z ciągłym monitorowaniem:

```bash
bin/npm run start
```

Serwer będzie nasłuchiwał na porcie 3000 i automatycznie przetwarzał nowe pliki.

### Tryb jednorazowy (manual)

Przetworzenie plików raz i zakończenie:

```bash
bin/node dist/index.js --manual
```

### Tryb deweloperski

Watch mode z automatycznym przebudowywaniem:

```bash
# Terminal 1 - kompilacja TypeScript
bin/npm run build:watch

# Terminal 2 - uruchomienie aplikacji
bin/npm run start
```

## Użytkowanie

### Dodawanie faktur

1. Dodaj plik PDF lub Excel do folderu źródłowego w Google Drive
2. Aplikacja automatycznie:
   - Wykryje nowy plik
   - Pobierze i przeanalizuje zawartość
   - Wyśle dane do iFirma.pl
   - Przeniesie plik do folderu przetworzonych

### Obsługiwane formaty

**PDF:**
- Faktury w formacie PDF z możliwością wyodrębnienia tekstu
- Automatyczne rozpoznawanie: numeru faktury, dat, kontrahenta, pozycji

**Excel (XLSX/XLS):**
- Struktura: wiersz 2 zawiera dane nagłówka, pozycje od wiersza 4
- Kolumny: stawka VAT, nazwa, ilość, cena

### Rozpoznawanie typu dokumentu

Aplikacja automatycznie rozpoznaje czy dokument to:
- **Faktura** - standardowe faktury zakupowe
- **Wydatek** - gdy nazwa pliku zawiera: `wydatek`, `koszty`, `rachunek`, `paragon`, `expense`

### Endpointy API

Aplikacja udostępnia następujące endpointy:

- `POST /webhook/drive` - Webhook dla powiadomień z Google Drive
- `POST /manual-process` - Ręczne wywołanie przetwarzania plików
- `GET /health` - Status aplikacji

### Monitoring

Sprawdzenie statusu kontenerów:
```bash
docker compose ps
```

Logi aplikacji:
```bash
docker compose logs -f app
```

### Testy

Uruchomienie testów:
```bash
# Testy jednorazowe
bin/npm run test:run

# Testy w trybie watch
bin/npm run test

# Testy z pokryciem kodu
bin/npm run test:coverage
```

## Rozwiązywanie problemów

### Błędy autoryzacji Google Drive
- Sprawdź czy plik `app/service-account-key.json` istnieje i jest poprawny
- Upewnij się, że foldery są udostępnione dla adresu e-mail konta usługi

### Błędy API iFirma
- Zweryfikuj klucze API w pliku `app/.env`
- Sprawdź czy konto iFirma ma aktywny dostęp do API

### Webhook nie działa
- Upewnij się, że tunel jest uruchomiony: `docker compose ps`
- Sprawdź logi ngrok: `docker compose logs ngrok`
- Zweryfikuj `WEBHOOK_URL` w `app/.env`

### Nie można połączyć się z kontenerem
- Upewnij się, że używasz skryptów `bin/*` zamiast bezpośrednich komend
- Uruchom komendy z katalogu głównego projektu, nie z `app/`

## Architektura

- **GDriveiFirmaWorkflow** - główny orkiestrator
- **FileProcessor** - przetwarzanie plików i ekstrakcja danych
- **iFirmaAPI** - komunikacja z API iFirma.pl
- **GoogleDriveClient** - integracja z Google Drive
- **WebhookServer** - serwer Express do obsługi webhooków

## Licencja

[Tu wstaw informacje o licencji]

## Kontakt

[Tu wstaw informacje kontaktowe]