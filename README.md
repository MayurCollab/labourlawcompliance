# ACC Labour Law Compliance

Gujarat Professional Tax operations tool for a consultancy that files **Form 5 (Namuno-5)** — return of tax payable by employer.

Built on the Express 5 + MongoDB + React 19 blueprint in this repo.

## Quick start

1. Copy `backend/.env.example` to `backend/.env` and fill in values.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Install backend deps (includes Chromium for PDF): `npm install` in `backend/`.
4. Seed admin + permissions: `npm run seed` from `backend/`.
5. Start API (`backend`, port 5000) and UI (`frontend`, port 5190).

## Form 5 workflow

1. **Uploads** — import MasterSheet (clients + monthly filings). Salary import is optional for PT slab compute and employee lists.
2. **Form 5** — open **Review** on a row: pick a bundled HTML template, set manual fields, compute PT, generate PDF.
3. **Danger zone (Uploads)** — purge master or salary data before a full re-import (`CLEAR MASTER` / `CLEAR SALARY`).

Bundled district templates (`form5-general`, `form5-mehsana`, etc.) ship with the app. Legacy uploaded Excel templates remain under **Templates (legacy)** for admins.

## Server dependencies for PDF generation

| Output path | Engine | Required? | Notes |
|-------------|--------|-----------|-------|
| **HTML templates (default)** | Puppeteer + Chromium | **Yes** | Installed by `npm install` in `backend/` (`puppeteer` package downloads Chromium). |
| **Excel templates (legacy)** | LibreOffice headless | Optional | Only if you still assign an uploaded `.xlsx` template. |

### Puppeteer / Chromium (HTML → PDF)

This is the **primary** Form 5 path. No separate Chromium install is usually needed.

**Local development (Windows / macOS / Linux)**

```bash
cd backend
npm install
npm run verify:form5   # optional smoke test; writes uploads/verify_Form5_html.pdf when OK
```

**Production / Linux server (no Docker)**

Chromium needs **OS libraries** (`libatk`, `libnss`, …). Those are **not** npm packages — they cannot be listed under `dependencies` in `package.json`. Instead, `backend/package.json` runs a postinstall script that installs them with `apt-get` on Linux when `NODE_ENV=production`.

1. On the server (as root, or with passwordless sudo):

   ```bash
   cd backend
   NODE_ENV=production npm ci
   # or: npm run setup:chromium-deps
   ```

   That installs Puppeteer’s Chromium **and** the Debian/Ubuntu packages listed in `scripts/installChromiumOsDeps.mjs`.

2. If postinstall skipped (no root/sudo), run once:

   ```bash
   sudo npm run setup:chromium-deps
   ```

3. If the process runs as a non-root user, ensure `/tmp` (or `PUPPETEER_TMP_DIR`) is writable.
4. Common launch flags are already set in code: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`.

**Verify Chromium on the server**

```bash
cd backend
node -e "import('./src/modules/filings/htmlToPdf.js').then(m => m.isChromiumAvailable().then(v => console.log('Chromium:', v)))"
```

Or run the full offline check:

```bash
npm run verify:form5
```

**Troubleshooting**

- `Could not render Form 5 PDF` — run the verify command above; install missing OS libraries.
- Docker OOM / slow PDF — increase memory; `--disable-dev-shm-usage` is already applied.
- Corporate proxy blocking Chromium download — set `PUPPETEER_DOWNLOAD_HOST` or install Chrome/Chromium system-wide and point Puppeteer at it (see [Puppeteer docs](https://pptr.dev/guides/configuration)).

### LibreOffice (legacy Excel → PDF)

Only required when a client still uses an **uploaded Excel** Form 5 template (not bundled HTML).

1. Install [LibreOffice](https://www.libreoffice.org/download/download/).
2. Set in `backend/.env` if `soffice` is not on PATH:

   ```env
   LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe
   ```

   Linux example: `/usr/bin/soffice`

3. Verify:

   ```bash
   cd backend
   node -e "import('./src/modules/filings/xlsxToPdf.js').then(m => m.isLibreOfficeAvailable().then(v => console.log('LibreOffice:', v)))"
   ```

If LibreOffice is missing, Excel-template generate still produces a filled `.xlsx` file (no PDF).

## Tests

```bash
cd backend
npm run test
```

Integration tests mock PDF engines; CI does not need Chromium or LibreOffice installed.

## API docs

Swagger UI at `/api-docs` when `NODE_ENV !== production` or `ENABLE_SWAGGER=true`.
