import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import config from '../../src/config/index.js';
import {
  sanitizeWhatsAppBodyValue,
  sendWhatsAppTemplateBatch,
} from '../../src/integrations/msg91/whatsapp.js';

const originalAuthKey = config.msg91.authKey;
const originalFetch = global.fetch;

beforeEach(() => {
  config.msg91.authKey = 'test-auth-key';
});

afterEach(() => {
  config.msg91.authKey = originalAuthKey;
  global.fetch = originalFetch;
});

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});

const rawResponse = (status, text) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => text,
});

// Matches exactly what filings.service.js builds — { name, namespace, language } —
// not the doc-comment's old `languageCode`, which is the mismatch this file guards.
const call = () =>
  sendWhatsAppTemplateBatch({
    template: { name: 'generic_one', namespace: 'ns-1', language: 'en' },
    entries: [
      {
        to: ['919999999999'],
        filename: 'Form5.pdf',
        mediaUrl: 'https://example.com/f.pdf',
        bodyValues: ['hello'],
      },
    ],
  });

describe('sendWhatsAppTemplateBatch — error detail surfacing', () => {
  test('uses payload.message when MSG91 provides one', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, { message: 'Template not approved' }),
    );

    const { chunks } = await call();

    expect(chunks[0].ok).toBe(false);
    expect(chunks[0].error.message).toBe(
      'MSG91 WhatsApp send failed (400): Template not approved',
    );
  });

  test('falls back to the raw body when MSG91 gives no message/error/errors field', async () => {
    // Exactly the sparse shape that used to produce an undiagnosable
    // "MSG91 WhatsApp send failed (400)" with no further detail.
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, { status: 'error', code: 'TEMPLATE_MISMATCH' }),
    );

    const { chunks } = await call();

    expect(chunks[0].error.message).toContain(
      'MSG91 WhatsApp send failed (400):',
    );
    expect(chunks[0].error.message).toContain('TEMPLATE_MISMATCH');
  });

  test('falls back to the raw response text when the body is not JSON', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(rawResponse(400, 'Bad Request: invalid namespace'));

    const { chunks } = await call();

    expect(chunks[0].error.message).toContain(
      'Bad Request: invalid namespace',
    );
  });

  test('a successful call reports ok with the parsed response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { requestId: 'req-1' }));

    const { chunks } = await call();

    expect(chunks[0].ok).toBe(true);
    expect(chunks[0].response).toEqual({ requestId: 'req-1' });
  });
});

describe('sendWhatsAppTemplateBatch — outgoing request shape', () => {
  test('sends the template name, namespace, and language code MSG91 requires', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { requestId: 'req-1' }));
    global.fetch = fetchMock;

    await call();

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);

    // Regression guard: sendWhatsAppTemplateBatch used to read
    // template.languageCode while every real caller passes template.language
    // — MSG91 then rejected every send with "template name and language is
    // required" because language.code came through as undefined.
    expect(body.payload.template).toMatchObject({
      name: 'generic_one',
      namespace: 'ns-1',
      language: { code: 'en', policy: 'deterministic' },
    });
  });

  test('collapses a line break in a body value instead of sending it as-is', async () => {
    // A 'single' mode template's whole composed message is one body value —
    // MSG91 rejects any body value containing "\n" ("next line(\n) is not
    // supported for body value"), so a template with a line break in it
    // used to fail every send.
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { requestId: 'req-1' }));
    global.fetch = fetchMock;

    await sendWhatsAppTemplateBatch({
      template: { name: 'generic_one', namespace: 'ns-1', language: 'en' },
      entries: [
        {
          to: ['919999999999'],
          bodyValues: ['hii Dipen,\nplease send the challan.'],
        },
      ],
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    const sentValue =
      body.payload.template.to_and_components[0].components.body_1.value;

    // Bolding is applied upstream by resolveWhatsAppMessage (per substituted
    // variable, not the whole value) — this layer only sanitizes transport
    // constraints, so a raw value passed straight in comes out unbolded.
    expect(sentValue).not.toContain('\n');
    expect(sentValue).toBe('hii Dipen, please send the challan.');
  });
});

describe('sanitizeWhatsAppBodyValue', () => {
  test('collapses newlines and carriage returns to a single space', () => {
    expect(sanitizeWhatsAppBodyValue('a\nb\r\nc\rd')).toBe('a b c d');
  });

  test('collapses runs of whitespace and trims the ends', () => {
    expect(sanitizeWhatsAppBodyValue('  a   b  ')).toBe('a b');
  });

  test('is a no-op for plain single-line text', () => {
    expect(sanitizeWhatsAppBodyValue('Mr. Dipen Shah')).toBe('Mr. Dipen Shah');
  });
});
