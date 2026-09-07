import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import AppError from '../../utils/AppError.js';
import { FILINGS_CODES } from './filings.constants.js';

const CANDIDATE_BINARIES = [
  process.env.LIBREOFFICE_PATH,
  process.env.SOFFICE_PATH,
  'soffice',
  'libreoffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
].filter(Boolean);

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveSoffice = async () => {
  for (const candidate of CANDIDATE_BINARIES) {
    if (
      path.isAbsolute(candidate) ||
      candidate.includes('\\') ||
      candidate.includes('/')
    ) {
      if (await fileExists(candidate)) return candidate;
      continue;
    }
    try {
      await run(candidate, ['--version'], { timeoutMs: 8_000 });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
};

const run = (command, args, { cwd, timeoutMs = 60_000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`LibreOffice timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `LibreOffice exited with code ${code}: ${stderr || stdout || 'no output'}`,
        ),
      );
    });
  });

/**
 * Convert a filled Form 5 .xlsx buffer to PDF via LibreOffice headless.
 * Requires LibreOffice installed (or LIBREOFFICE_PATH / SOFFICE_PATH).
 */
export const convertXlsxBufferToPdf = async (xlsxBuffer, baseName = 'Form5') => {
  const soffice = await resolveSoffice();
  if (!soffice) {
    throw new AppError(
      'LibreOffice is required to convert Form 5 Excel to PDF. Install LibreOffice and set LIBREOFFICE_PATH if needed.',
      422,
      { code: FILINGS_CODES.PDF_CONVERTER_MISSING },
    );
  }

  const safeBase = String(baseName || 'Form5')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80) || 'Form5';
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'form5-pdf-'));
  const inputPath = path.join(dir, `${safeBase}.xlsx`);
  const outputPath = path.join(dir, `${safeBase}.pdf`);

  try {
    await fs.writeFile(inputPath, xlsxBuffer);
    try {
      await run(
        soffice,
        [
          '--headless',
          '--nologo',
          '--nofirststartwizard',
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          inputPath,
        ],
        { cwd: dir },
      );
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new AppError(
          'LibreOffice is required to convert Form 5 Excel to PDF. Install LibreOffice and set LIBREOFFICE_PATH if needed.',
          422,
          { code: FILINGS_CODES.PDF_CONVERTER_MISSING },
        );
      }
      throw new AppError(
        `Could not convert Form 5 Excel to PDF: ${error.message}`,
        422,
        { code: FILINGS_CODES.PDF_CONVERT_FAILED },
      );
    }

    if (!(await fileExists(outputPath))) {
      const files = await fs.readdir(dir);
      const pdfName = files.find((name) => name.toLowerCase().endsWith('.pdf'));
      if (!pdfName) {
        throw new AppError(
          'LibreOffice did not produce a PDF for this Form 5.',
          422,
          { code: FILINGS_CODES.PDF_CONVERT_FAILED },
        );
      }
      return fs.readFile(path.join(dir, pdfName));
    }

    return fs.readFile(outputPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

export const isLibreOfficeAvailable = async () =>
  Boolean(await resolveSoffice());

