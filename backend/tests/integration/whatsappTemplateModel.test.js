import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';

import {
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
} from '../helpers/db.js';
import WhatsAppTemplate from '../../src/modules/whatsappTemplates/whatsappTemplate.model.js';
import { toWhatsAppTemplateDto } from '../../src/modules/whatsappTemplates/whatsappTemplates.dto.js';
import {
  createWhatsAppTemplateSchema,
  updateWhatsAppTemplateSchema,
} from '../../src/modules/whatsappTemplates/whatsappTemplates.validation.js';

const base = {
  label: 'Generic message',
  msg91TemplateName: 'generic_one',
  namespace: 'ns-2',
  languageCode: 'en',
};

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe('WhatsAppTemplate variables', () => {
  test('a variable stored without a type reads back as a field variable', async () => {
    // Exactly how the seeded "Form 5 reminder" is written today.
    const created = await WhatsAppTemplate.create({
      ...base,
      label: 'Form 5 reminder',
      bodyPreview: 'Hii {{RecipientName}}',
      variables: [{ field: 'recipientName' }],
    });

    const found = await WhatsAppTemplate.findById(created._id);

    expect(found.variables[0].type).toBe('field');
    expect(found.variables[0].field).toBe('recipientName');
    expect(toWhatsAppTemplateDto(found).variables).toEqual([
      { type: 'field', field: 'recipientName' },
    ]);
  });

  test('a custom variable round-trips its label and token', async () => {
    const created = await WhatsAppTemplate.create({
      ...base,
      bodyPreview: 'Hii, {{CustomText1}} thankyou',
      variables: [
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    });

    const found = await WhatsAppTemplate.findById(created._id);

    expect(toWhatsAppTemplateDto(found).variables).toEqual([
      { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
    ]);
  });

  test('a custom variable without a label is rejected', async () => {
    await expect(
      WhatsAppTemplate.create({
        ...base,
        bodyPreview: 'Hii, {{CustomText1}} thankyou',
        variables: [{ type: 'custom', token: '{{CustomText1}}' }],
      }),
    ).rejects.toThrow(/label/i);
  });

  test('a custom variable without a well-formed token is rejected', async () => {
    await expect(
      WhatsAppTemplate.create({
        ...base,
        bodyPreview: 'Hii, CustomText1 thankyou',
        variables: [{ type: 'custom', label: 'Message text', token: 'nope' }],
      }),
    ).rejects.toThrow(/placeholder/i);
  });

  test('a field variable without a field is rejected', async () => {
    await expect(
      WhatsAppTemplate.create({
        ...base,
        bodyPreview: 'Hii',
        variables: [{ type: 'field' }],
      }),
    ).rejects.toThrow(/field/i);
  });
});

describe('WhatsAppTemplate bodyMode', () => {
  test('a doc created before bodyMode existed reads back as positional', async () => {
    const created = await WhatsAppTemplate.create({
      ...base,
      label: 'Form 5 reminder',
      bodyPreview: 'Hii {{RecipientName}}',
      variables: [{ field: 'recipientName' }],
    });

    // Written exactly like the seeded Template 1 — no bodyMode in the insert.
    const found = await WhatsAppTemplate.findById(created._id);
    expect(found.bodyMode).toBe('positional');
  });

  test('an explicit "single" bodyMode round-trips', async () => {
    const created = await WhatsAppTemplate.create({
      ...base,
      bodyMode: 'single',
      bodyPreview: 'Hii, {{CustomText1}} thankyou',
      variables: [
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    });

    const found = await WhatsAppTemplate.findById(created._id);
    expect(found.bodyMode).toBe('single');
    expect(toWhatsAppTemplateDto(found).bodyMode).toBe('single');
  });

  test('an invalid bodyMode is rejected', async () => {
    await expect(
      WhatsAppTemplate.create({
        ...base,
        bodyMode: 'positionalish',
        bodyPreview: 'Hii',
        variables: [{ field: 'recipientName' }],
      }),
    ).rejects.toThrow();
  });
});

describe('WhatsAppTemplate validation schemas', () => {
  test('accepts a legacy variable with no type and defaults it to field', () => {
    const parsed = createWhatsAppTemplateSchema.parse({
      ...base,
      bodyPreview: 'Hii {{RecipientName}}',
      variables: [{ field: 'recipientName' }],
    });

    expect(parsed.variables).toEqual([
      { type: 'field', field: 'recipientName' },
    ]);
  });

  test('accepts a create payload with no msg91TemplateName/namespace at all', () => {
    // What the simplified "New Template" UI actually sends — the service
    // fills in msg91TemplateName/namespace from the generic MSG91 config.
    const parsed = createWhatsAppTemplateSchema.parse({
      label: 'Challan reminder',
      bodyPreview: 'Hii, {{CustomText1}} thankyou',
      variables: [
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    });

    expect(parsed.msg91TemplateName).toBeUndefined();
    expect(parsed.namespace).toBeUndefined();
  });

  test('rejects msg91TemplateName given without a namespace', () => {
    expect(() =>
      createWhatsAppTemplateSchema.parse({
        label: 'Challan reminder',
        msg91TemplateName: 'generic_one',
        bodyPreview: 'Hii, {{CustomText1}} thankyou',
        variables: [
          { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
        ],
      }),
    ).toThrow();
  });

  test('accepts a custom variable', () => {
    const parsed = createWhatsAppTemplateSchema.parse({
      ...base,
      bodyPreview: 'Hii, {{CustomText1}} thankyou',
      variables: [
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    });

    expect(parsed.variables[0]).toEqual({
      type: 'custom',
      label: 'Message text',
      token: '{{CustomText1}}',
    });
  });

  test('rejects a custom variable with a blank label', () => {
    expect(() =>
      createWhatsAppTemplateSchema.parse({
        ...base,
        bodyPreview: 'Hii, {{CustomText1}} thankyou',
        variables: [{ type: 'custom', label: '  ', token: '{{CustomText1}}' }],
      }),
    ).toThrow();
  });

  test('rejects two custom variables sharing one token', () => {
    expect(() =>
      createWhatsAppTemplateSchema.parse({
        ...base,
        bodyPreview: 'Hii, {{CustomText1}} thankyou',
        variables: [
          { type: 'custom', label: 'One', token: '{{CustomText1}}' },
          { type: 'custom', label: 'Two', token: '{{CustomText1}}' },
        ],
      }),
    ).toThrow();
  });

  test('update accepts a mixed variable list', () => {
    const parsed = updateWhatsAppTemplateSchema.parse({
      variables: [
        { field: 'recipientName' },
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
    });

    expect(parsed.variables).toEqual([
      { type: 'field', field: 'recipientName' },
      { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
    ]);
  });
});
