import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../../src/email/emailService.js', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const { connectTestDb, clearTestDb, disconnectTestDb } = await import(
  '../helpers/db.js'
);
const { seedRbac, createVerifiedUser, loginAs, authHeader } = await import(
  '../helpers/fixtures.js'
);
const config = (await import('../../src/config/index.js')).default;
const Location = (await import('../../src/modules/locations/location.model.js'))
  .default;
const Client = (await import('../../src/modules/clients/client.model.js'))
  .default;
const Filing = (await import('../../src/modules/filings/filing.model.js'))
  .default;
const WhatsAppTemplate = (
  await import('../../src/modules/whatsappTemplates/whatsappTemplate.model.js')
).default;
const app = (await import('../../src/app.js')).default;

const originalAuthKey = config.msg91.authKey;
const originalFetch = global.fetch;

/**
 * A 'single' mode template targets MSG91's generic text-only template — it
 * has no document header, so sending it must not require (or attach) a
 * generated Form 5 PDF. Covers the branch added to sendFilingWhatsApp /
 * bulkSendFilingsWhatsApp after MSG91 rejected a document header on a
 * template that doesn't have one ("Template does not contain title
 * component, no parameters allowed").
 */
describe('WhatsApp send — text-only (bodyMode: single) template needs no generated PDF', () => {
  let auth;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
    config.msg91.authKey = originalAuthKey;
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    await clearTestDb();
    const rbac = await seedRbac();
    await createVerifiedUser({
      email: 'admin@example.com',
      password: 'Password1',
      role: rbac.superAdmin._id,
    });
    auth = await loginAs(app, request, {
      email: 'admin@example.com',
      password: 'Password1',
    });

    config.msg91.authKey = 'test-auth-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ requestId: 'req-1' }),
    });
  });

  const seedFilingWithoutPdf = async () => {
    const location = await Location.create({
      name: 'Ahmedabad',
      nameKey: 'ahmedabad',
    });
    const client = await Client.create({
      clientCode: 'C0001',
      companyName: 'Acer India Pvt. Ltd.',
      location: location._id,
      contactNumber: '9825012345',
      recipientName: 'Dipen Shah',
    });
    // generateStatus defaults to 'pending' — no generatedFile at all.
    const filing = await Filing.create({
      client: client._id,
      clientCode: client.clientCode,
      period: '2026-08',
      periodLabel: 'Aug-2026',
    });
    return { location, client, filing };
  };

  const seedTextOnlyTemplate = async () =>
    WhatsAppTemplate.create({
      label: 'Challan reminder',
      msg91TemplateName: 'generic_one',
      namespace: 'ns-1',
      languageCode: 'en',
      bodyMode: 'single',
      bodyPreview: 'Hii {{RecipientName}}, please deposit the challan.',
      variables: [{ type: 'field', field: 'recipientName' }],
      isActive: true,
    });

  test('POST /filings/:id/whatsapp sends without a generated PDF and attaches nothing', async () => {
    const { filing } = await seedFilingWithoutPdf();
    const template = await seedTextOnlyTemplate();

    const response = await request(app)
      .post(`/api/v1/filings/${filing.id}/whatsapp`)
      .set(authHeader(auth.accessToken))
      .send({ templateId: String(template._id) });

    expect(response.status).toBe(200);

    // The outgoing MSG91 request must carry no header_1 (document) component —
    // this text-only template has no header slot for one.
    const [, requestInit] = global.fetch.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    const components =
      body.payload.template.to_and_components[0].components;
    expect(components.header_1).toBeUndefined();
    expect(components.body_1.value).toContain('Dipen Shah');
  });

  test('POST /filings/bulk-whatsapp sends without a generated PDF for a single-mode template', async () => {
    const { filing } = await seedFilingWithoutPdf();
    const template = await seedTextOnlyTemplate();

    const response = await request(app)
      .post('/api/v1/filings/bulk-whatsapp')
      .set(authHeader(auth.accessToken))
      .send({ ids: [filing.id], templateId: String(template._id) });

    expect(response.status).toBe(200);
    expect(response.body.data.sent).toBe(1);
    expect(response.body.data.skipped).toBe(0);

    const [, requestInit] = global.fetch.mock.calls[0];
    const body = JSON.parse(requestInit.body);
    const components =
      body.payload.template.to_and_components[0].components;
    expect(components.header_1).toBeUndefined();
  });

  test('a positional (Template 1 shape) template still requires a generated PDF', async () => {
    const { filing } = await seedFilingWithoutPdf();
    const template = await WhatsAppTemplate.create({
      label: 'Form 5 reminder',
      msg91TemplateName: 'ankit_chokshi_new',
      namespace: 'ns-2',
      languageCode: 'en',
      bodyPreview: 'Hii {{RecipientName}}',
      variables: [{ type: 'field', field: 'recipientName' }],
      isActive: true,
      // bodyMode omitted — defaults to 'positional', same as the real seeded template.
    });

    const response = await request(app)
      .post(`/api/v1/filings/${filing.id}/whatsapp`)
      .set(authHeader(auth.accessToken))
      .send({ templateId: String(template._id) });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Generate the Form 5 PDF/i);
  });
});
