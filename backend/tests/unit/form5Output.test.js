import { describe, expect, test, afterEach } from '@jest/globals';

import { FILINGS_CODES } from '../../src/modules/filings/filings.constants.js';
import { resolveForm5OutputBuffer } from '../../src/modules/filings/form5Output.js';
import {
  clearBrowserLauncherForTests,
  setBrowserLauncherForTests,
} from '../../src/modules/filings/htmlToPdf.js';

const FAKE_PDF = Buffer.from('%PDF-1.4\n% mock form5 pdf\n');

const mockBrowser = () => ({
  connected: true,
  on: () => {},
  newPage: async () => ({
    setDefaultNavigationTimeout: () => {},
    setDefaultTimeout: () => {},
    setContent: async () => {},
    pdf: async () => FAKE_PDF,
    close: async () => {},
  }),
  close: async () => {},
});

afterEach(() => {
  clearBrowserLauncherForTests();
});

describe('resolveForm5OutputBuffer', () => {
  test('HTML templates always produce PDF', async () => {
    setBrowserLauncherForTests(async () => mockBrowser());

    const result = await resolveForm5OutputBuffer({
      template: { kind: 'html' },
      filled: Buffer.from('<html><body>Form 5</body></html>', 'utf8'),
      filing: { clientCode: 'C0099', period: '2026-07' },
      client: { location: { name: 'Anand' } },
    });

    expect(result.ext).toBe('.pdf');
    expect(result.mimetype).toBe('application/pdf');
    expect(result.buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
  });

  test('HTML PDF failure surfaces error without HTML fallback', async () => {
    setBrowserLauncherForTests(async () => {
      throw new Error('Chromium unavailable');
    });

    await expect(
      resolveForm5OutputBuffer({
        template: { kind: 'html' },
        filled: Buffer.from('<html><body>Form 5</body></html>', 'utf8'),
        filing: { clientCode: 'C0099', period: '2026-07' },
        client: { location: { name: 'Anand' } },
      }),
    ).rejects.toMatchObject({
      code: FILINGS_CODES.PDF_CONVERT_FAILED,
    });
  });
});
