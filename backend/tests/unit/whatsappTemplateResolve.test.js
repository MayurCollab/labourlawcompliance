import { describe, expect, test } from '@jest/globals';

import {
  listCustomVariables,
  missingCustomValues,
  missingFieldsMessage,
  resolveWhatsAppMessage,
  toTemplateSnapshot,
} from '../../src/modules/whatsappTemplates/whatsappTemplates.resolve.js';

const sourceData = {
  recipientName: 'Mr. Sharma',
  companyName: 'Acer India Pvt. Ltd.',
  clientCode: 'C0001',
  month: 'July',
  year: '2026',
  periodLabel: 'Jul-2026',
  signatoryName: 'Authorized Signatory',
};

/** Mirrors the seeded "Form 5 reminder" as it is stored today: no `type` key. */
const legacyTemplate = {
  id: 'tpl-legacy',
  label: 'Form 5 reminder',
  msg91TemplateName: 'labour_law',
  namespace: 'ns-1',
  languageCode: 'en',
  bodyPreview:
    'Hii {{RecipientName}}, Form-5 for {{MonthOfForm5}} {{Year}} is attached.',
  variables: [{ field: 'recipientName' }, { field: 'month' }, { field: 'year' }],
};

/** The one-variable approved template: "Hii," and "thankyou" are fixed wording. */
const customTemplate = {
  id: 'tpl-custom',
  label: 'Generic message',
  msg91TemplateName: 'generic_one',
  namespace: 'ns-2',
  languageCode: 'en',
  bodyPreview: 'Hii, {{CustomText1}} thankyou',
  variables: [
    { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
  ],
};

/**
 * A template created through the app now: bodyMode 'single' — whatever the
 * operator composed (fields + custom text) collapses into the ONE value MSG91
 * receives, since the generic approved template has one variable slot.
 */
const singleModeTemplate = {
  id: 'tpl-single',
  label: 'Challan reminder',
  msg91TemplateName: 'generic_one',
  namespace: 'ns-2',
  languageCode: 'en',
  bodyMode: 'single',
  bodyPreview: '{{RecipientName}}, please send the {{CustomText1}} challan.',
  variables: [
    { type: 'field', field: 'recipientName' },
    { type: 'custom', label: 'Month', token: '{{CustomText1}}' },
  ],
};

describe('resolveWhatsAppMessage', () => {
  test('variables stored without a type still resolve as data fields', () => {
    const { bodyValues, missing } = resolveWhatsAppMessage(
      legacyTemplate,
      sourceData,
    );

    expect(bodyValues).toEqual(['*Mr. Sharma*', '*July*', '*2026*']);
    expect(missing).toEqual([]);
  });

  test('a custom variable takes the text typed at send time', () => {
    const { bodyValues, missing, previewText } = resolveWhatsAppMessage(
      customTemplate,
      sourceData,
      { '{{CustomText1}}': 'your PT payment is due' },
    );

    expect(bodyValues).toEqual(['*your PT payment is due*']);
    expect(missing).toEqual([]);
    // Fixed wording around the variable is untouched; the value itself is bold.
    expect(previewText).toBe('Hii, *your PT payment is due* thankyou');
  });

  test('a custom value can also be keyed by its body slot index', () => {
    const { bodyValues } = resolveWhatsAppMessage(customTemplate, sourceData, {
      0: 'by index',
    });

    expect(bodyValues).toEqual(['*by index*']);
  });

  test('field and custom variables fill body slots in array order', () => {
    const mixed = {
      ...customTemplate,
      bodyPreview: 'Hii {{RecipientName}}, {{CustomText1}} — {{MonthOfForm5}}',
      variables: [
        { type: 'field', field: 'recipientName' },
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
        { type: 'field', field: 'month' },
      ],
    };

    const { bodyValues, previewText } = resolveWhatsAppMessage(
      mixed,
      sourceData,
      { '{{CustomText1}}': 'please check' },
    );

    expect(bodyValues).toEqual(['*Mr. Sharma*', '*please check*', '*July*']);
    expect(previewText).toBe('Hii *Mr. Sharma*, *please check* — *July*');
  });

  test('bodyMode "single" bolds only the substituted values, not the literal text around them', () => {
    // This is the exact bug reported: a "single" template's whole message
    // used to come out entirely bold, when only the variable parts should be.
    const template = {
      ...singleModeTemplate,
      bodyPreview:
        '{{RecipientName}}, here is the gentle reminder for {{CustomText1}}.',
    };

    const { bodyValues } = resolveWhatsAppMessage(template, sourceData, {
      '{{CustomText1}}': 'August',
    });

    expect(bodyValues).toEqual([
      '*Mr. Sharma*, here is the gentle reminder for *August*.',
    ]);
  });

  test('a missing custom value is reported by its label, not its token', () => {
    const { missing } = resolveWhatsAppMessage(customTemplate, sourceData, {});

    expect(missing).toEqual(['Message text']);
    expect(missingFieldsMessage(missing)).toBe('Missing value for: Message text');
  });

  test('an unfilled custom token stays visible in the preview', () => {
    const { previewText } = resolveWhatsAppMessage(customTemplate, sourceData, {});

    expect(previewText).toBe('Hii, {{CustomText1}} thankyou');
  });

  test('a missing data field is still reported by its field label', () => {
    const { missing } = resolveWhatsAppMessage(legacyTemplate, {
      ...sourceData,
      month: '',
    });

    expect(missing).toEqual(['Month of Form 5 (e.g. July)']);
  });

  test('an omitted bodyMode still resolves positionally (Template 1 regression guard)', () => {
    const { bodyValues } = resolveWhatsAppMessage(legacyTemplate, sourceData);

    // Legacy template has no bodyMode key at all — must behave exactly as
    // before bodyMode existed: one entry per variable, not a single string.
    expect(legacyTemplate.bodyMode).toBeUndefined();
    expect(bodyValues).toEqual(['*Mr. Sharma*', '*July*', '*2026*']);
  });

  test('bodyMode "single" collapses every variable into one combined value', () => {
    const { bodyValues, missing } = resolveWhatsAppMessage(
      singleModeTemplate,
      sourceData,
      { '{{CustomText1}}': 'July' },
    );

    expect(bodyValues).toEqual([
      '*Mr. Sharma*, please send the *July* challan.',
    ]);
    expect(missing).toEqual([]);
  });

  test('bodyMode "single" still names which variable is missing', () => {
    const { missing } = resolveWhatsAppMessage(singleModeTemplate, sourceData, {});

    expect(missing).toEqual(['Month']);
  });
});

describe('missingCustomValues', () => {
  test('lists custom variables with no value so bulk sends can fail up front', () => {
    expect(missingCustomValues(customTemplate, {})).toEqual(['Message text']);
    expect(
      missingCustomValues(customTemplate, { '{{CustomText1}}': 'filled' }),
    ).toEqual([]);
  });

  test('a field-only template never blocks on custom values', () => {
    expect(missingCustomValues(legacyTemplate, {})).toEqual([]);
  });
});

describe('listCustomVariables', () => {
  test('returns each custom variable with its body slot index', () => {
    const mixed = {
      ...customTemplate,
      variables: [
        { type: 'field', field: 'recipientName' },
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    };

    expect(listCustomVariables(mixed)).toEqual([
      { index: 1, token: '{{CustomText1}}', label: 'Message text' },
    ]);
  });
});

describe('toTemplateSnapshot', () => {
  test('keeps the label and token so history explains what was sent', () => {
    expect(toTemplateSnapshot(customTemplate).variables).toEqual([
      { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
    ]);
  });

  test('normalizes legacy field variables to an explicit type', () => {
    expect(toTemplateSnapshot(legacyTemplate).variables).toEqual([
      { type: 'field', field: 'recipientName' },
      { type: 'field', field: 'month' },
      { type: 'field', field: 'year' },
    ]);
  });

  test('defaults a missing bodyMode to positional', () => {
    expect(toTemplateSnapshot(legacyTemplate).bodyMode).toBe('positional');
  });

  test('carries an explicit bodyMode through', () => {
    expect(toTemplateSnapshot(singleModeTemplate).bodyMode).toBe('single');
  });
});
