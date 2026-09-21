import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';

import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db.js';
import config from '../../src/config/index.js';
import {
  createWhatsAppTemplate,
} from '../../src/modules/whatsappTemplates/whatsappTemplates.service.js';

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

// config.msg91.genericTemplate is a live object on the imported singleton —
// mutate it directly to simulate different backend/.env states, and restore
// it after each test so other suites aren't affected.
const originalGenericTemplate = { ...config.msg91.genericTemplate };

afterEach(() => {
  Object.assign(config.msg91.genericTemplate, originalGenericTemplate);
});

describe('createWhatsAppTemplate — resolving the MSG91 target', () => {
  test('with no msg91TemplateName given, fills in the configured generic template and sets bodyMode "single"', async () => {
    Object.assign(config.msg91.genericTemplate, {
      name: 'generic_one',
      namespace: 'ns-generic',
      language: 'en',
    });

    const dto = await createWhatsAppTemplate({
      label: 'Challan reminder',
      bodyPreview: 'Hii, {{CustomText1}} thankyou',
      variables: [
        { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
      ],
      isActive: true,
    });

    expect(dto.msg91TemplateName).toBe('generic_one');
    expect(dto.namespace).toBe('ns-generic');
    expect(dto.languageCode).toBe('en');
    expect(dto.bodyMode).toBe('single');
  });

  test('rejects creation when the generic template is not configured', async () => {
    Object.assign(config.msg91.genericTemplate, { name: '', namespace: '', language: 'en' });

    await expect(
      createWhatsAppTemplate({
        label: 'Challan reminder',
        bodyPreview: 'Hii, {{CustomText1}} thankyou',
        variables: [
          { type: 'custom', label: 'Message text', token: '{{CustomText1}}' },
        ],
        isActive: true,
      }),
    ).rejects.toThrow(/generic MSG91 template is not configured/i);
  });

  test('an explicit msg91TemplateName is honored as given and resolves positionally', async () => {
    // Not reachable from the simplified UI, kept for API flexibility — this is
    // how Template 1 (the 3-variable "Form 5 reminder") would still be made.
    const dto = await createWhatsAppTemplate({
      label: 'Form 5 reminder',
      msg91TemplateName: 'ankit_chokshi_new',
      namespace: 'f81e39d2_346b_4801_8a3d_b74b0141f1e2',
      languageCode: 'en',
      bodyPreview: 'Hii {{RecipientName}}',
      variables: [{ type: 'field', field: 'recipientName' }],
      isActive: true,
    });

    expect(dto.msg91TemplateName).toBe('ankit_chokshi_new');
    expect(dto.namespace).toBe('f81e39d2_346b_4801_8a3d_b74b0141f1e2');
    expect(dto.bodyMode).toBe('positional');
  });
});
