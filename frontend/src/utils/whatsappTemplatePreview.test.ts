import { describe, expect, it } from 'vitest';

import {
  resolveWhatsAppPreview,
  splitWhatsAppBoldSegments,
  wrapWithGenericTemplate,
} from './whatsappTemplatePreview';
import type {
  WhatsAppSourceData,
  WhatsAppTemplateField,
} from '@/types/whatsappTemplate.types';

const fields: WhatsAppTemplateField[] = [
  {
    field: 'recipientName',
    token: '{{RecipientName}}',
    label: 'Recipient name',
    sample: 'Mr. Dipen Shah',
  },
];

const sourceData: WhatsAppSourceData = {
  recipientName: 'Mr. Dipen Shah',
  companyName: '',
  clientCode: '',
  month: 'August',
  year: '2026',
  periodLabel: '',
  signatoryName: '',
};

describe('resolveWhatsAppPreview', () => {
  it('bolds only the substituted value, leaving literal text plain', () => {
    // The exact bug reported: a 'single' template's whole message came out
    // entirely bold — only the variable itself should be.
    const result = resolveWhatsAppPreview(
      '{{RecipientName}}, here is the gentle reminder.',
      fields,
      sourceData,
    );

    expect(result).toBe('*Mr. Dipen Shah*, here is the gentle reminder.');
  });

  it('does not bold an unfilled custom-text bracket hint', () => {
    const result = resolveWhatsAppPreview(
      'Hii, {{CustomText1}}',
      [],
      sourceData,
      [{ type: 'custom', label: 'Message text', token: '{{CustomText1}}' }],
      {},
    );

    expect(result).toBe('Hii, [Message text]');
  });

  it('bolds a typed custom value', () => {
    const result = resolveWhatsAppPreview(
      'Hii, {{CustomText1}}',
      [],
      sourceData,
      [{ type: 'custom', label: 'Message text', token: '{{CustomText1}}' }],
      { '{{CustomText1}}': 'please pay' },
    );

    expect(result).toBe('Hii, *please pay*');
  });
});

describe('wrapWithGenericTemplate', () => {
  it('joins the fixed prefix and suffix around the composed body', () => {
    const wrapped = wrapWithGenericTemplate('*Mr. Dipen Shah*, reminder.', {
      prefix: 'Hii',
      suffix: ',\n\nThank you',
    });

    expect(wrapped).toBe('Hii *Mr. Dipen Shah*, reminder.,\n\nThank you');
  });
});

describe('splitWhatsAppBoldSegments', () => {
  it('splits mixed plain and bold text into renderable segments', () => {
    expect(
      splitWhatsAppBoldSegments('Hii *Mr. Dipen Shah*, reminder.'),
    ).toEqual([
      { text: 'Hii ', bold: false },
      { text: 'Mr. Dipen Shah', bold: true },
      { text: ', reminder.', bold: false },
    ]);
  });

  it('returns a single plain segment when there is no bold marker', () => {
    expect(splitWhatsAppBoldSegments('plain text')).toEqual([
      { text: 'plain text', bold: false },
    ]);
  });

  it('handles multiple bold segments', () => {
    expect(splitWhatsAppBoldSegments('*a* and *b*')).toEqual([
      { text: 'a', bold: true },
      { text: ' and ', bold: false },
      { text: 'b', bold: true },
    ]);
  });
});
