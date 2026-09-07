import AppError from '../../utils/AppError.js';
import { FILINGS_CODES } from './filings.constants.js';

/** @type {(() => Promise<import('puppeteer').Browser>) | null} */
let browserLauncherOverride = null;

/** @type {import('puppeteer').Browser | null} */
let sharedBrowser = null;

/** @type {Promise<import('puppeteer').Browser> | null} */
let sharedBrowserPromise = null;

/**
 * Inject a custom browser launcher (tests only).
 */
export const setBrowserLauncherForTests = (launcher) => {
  browserLauncherOverride = launcher ?? null;
  sharedBrowser = null;
  sharedBrowserPromise = null;
};

export const clearBrowserLauncherForTests = () => {
  browserLauncherOverride = null;
  sharedBrowser = null;
  sharedBrowserPromise = null;
};

/** Close the shared Chromium instance (tests / graceful shutdown). */
export const closeSharedBrowser = async () => {
  const browser = sharedBrowser;
  sharedBrowser = null;
  sharedBrowserPromise = null;
  if (browser) {
    await browser.close().catch(() => {});
  }
};

const DEFAULT_PDF_OPTIONS = Object.freeze({
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: {
    top: '12mm',
    right: '10mm',
    bottom: '12mm',
    left: '10mm',
  },
});

const launchBrowser = async () => {
  if (browserLauncherOverride) {
    return browserLauncherOverride();
  }
  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });
};

/**
 * Reuse one Chromium process across Form 5 PDFs.
 * Launching a new browser per file is the main bulk-generate cost.
 */
const getSharedBrowser = async () => {
  if (sharedBrowser?.connected !== false && sharedBrowser) {
    return sharedBrowser;
  }
  if (sharedBrowserPromise) return sharedBrowserPromise;

  sharedBrowserPromise = launchBrowser()
    .then((browser) => {
      sharedBrowser = browser;
      sharedBrowserPromise = null;
      if (typeof browser?.on === 'function') {
        browser.on('disconnected', () => {
          if (sharedBrowser === browser) {
            sharedBrowser = null;
          }
        });
      }
      return browser;
    })
    .catch((error) => {
      sharedBrowserPromise = null;
      throw error;
    });

  return sharedBrowserPromise;
};

/**
 * Render filled Form 5 HTML to an A4 PDF buffer via headless Chromium.
 */
export const renderForm5Pdf = async ({
  html,
  pdfOptions = {},
  timeoutMs = 60_000,
} = {}) => {
  const content = String(html ?? '').trim();
  if (!content) {
    throw new AppError('HTML content is required to render Form 5 PDF.', 422, {
      code: FILINGS_CODES.PDF_CONVERT_FAILED,
    });
  }

  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);

    // Self-contained Form 5 HTML (inline CSS / data URIs). Avoid networkidle0 —
    // external font CSS can stall for seconds on every file.
    await page.setContent(content, {
      waitUntil: 'load',
      timeout: timeoutMs,
    });

    const pdfBuffer = await page.pdf({
      ...DEFAULT_PDF_OPTIONS,
      ...pdfOptions,
    });

    if (!pdfBuffer?.length) {
      throw new AppError(
        'Chromium did not produce a PDF for this Form 5.',
        422,
        { code: FILINGS_CODES.PDF_CONVERT_FAILED },
      );
    }

    return Buffer.from(pdfBuffer);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error?.name === 'TimeoutError') {
      throw new AppError(
        `Form 5 PDF render timed out after ${timeoutMs}ms.`,
        422,
        { code: FILINGS_CODES.PDF_CONVERT_FAILED },
      );
    }
    throw new AppError(
      `Could not render Form 5 PDF: ${error.message}`,
      422,
      { code: FILINGS_CODES.PDF_CONVERT_FAILED },
    );
  } finally {
    if (page && typeof page.close === 'function') {
      await page.close().catch(() => {});
    }
  }
};

/**
 * Fill HTML then render PDF — convenience for the generate pipeline.
 */
export const renderForm5PdfFromHtml = async ({ html, pdfOptions, timeoutMs }) =>
  renderForm5Pdf({ html, pdfOptions, timeoutMs });

const PDF_MAGIC = Buffer.from('%PDF');

export const isPdfBuffer = (buffer) =>
  Buffer.isBuffer(buffer) &&
  buffer.length >= 4 &&
  buffer.subarray(0, 4).equals(PDF_MAGIC);

/**
 * Check whether Puppeteer can launch Chromium on this host.
 */
export const isChromiumAvailable = async () => {
  try {
    const browser = await getSharedBrowser();
    return Boolean(browser);
  } catch {
    return false;
  }
};
