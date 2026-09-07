import { describe, expect, test } from '@jest/globals';

import {
  BUNDLED_FORM5_TEMPLATES,
  bundledStoredPath,
} from '../../src/templates/form5/bundledTemplates.constants.js';
import { readBundledTemplateBuffer } from '../../src/templates/form5/readBundledTemplate.js';
import { sampleForm5PreviewValues } from '../../src/templates/form5/samplePreviewValues.js';
import {
  fillHtmlTemplate,
  flattenValuesForHandlebars,
  resolveOfficialSlabRows,
} from '../../src/modules/templates/htmlFill.js';

describe('bundled Form 5 HTML templates', () => {
  test('catalog has six templates', () => {
    expect(BUNDLED_FORM5_TEMPLATES).toHaveLength(6);
  });

  test.each(BUNDLED_FORM5_TEMPLATES.map((entry) => [entry.code, entry.file]))(
    '%s reads from disk',
    async (code) => {
      const buffer = await readBundledTemplateBuffer(code);
      expect(buffer.length).toBeGreaterThan(200);
      expect(buffer.toString('utf8')).toContain('<html');
    },
  );

  test('form5-general fills PDF-accurate English layout', async () => {
    const buffer = await readBundledTemplateBuffer('form5-general');
    const html = await fillHtmlTemplate(
      buffer.toString('utf8'),
      sampleForm5PreviewValues(),
    );
    expect(html).toContain('FORM 5');
    expect(html).toContain('Times New Roman');
    expect(html).toContain('SMFG India Credit Co. Ltd.');
    expect(html).toContain('PRC016780178');
    expect(html).toContain('Jul-26');
    expect(html).toContain('11800');
    expect(html).toContain('Authorised Signatory');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('#FFFF00');
    expect(html).not.toContain('#C0645C');
    expect(html).toContain('Professional Tax for the Month of');
    expect(html).toContain('July-26');
    expect(html).toContain('For ');
    expect(html).toContain('Authorized Signatory');
    expect(html).toContain('Eligible Employee Count for Professional Tax');
    expect(html).toContain('Client name:');
    expect(html).toContain('Grand Total');
    expect(html).toContain('PHY CODE');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('Noto Sans Gujarati');
  });

  test.each(
    BUNDLED_FORM5_TEMPLATES.filter((entry) => entry.code !== 'form5-general').map(
      (entry) => [entry.code],
    ),
  )('%s fills with sample values and partials', async (code) => {
    const buffer = await readBundledTemplateBuffer(code);
    const html = await fillHtmlTemplate(
      buffer.toString('utf8'),
      sampleForm5PreviewValues(),
    );
    expect(html).toContain('SMFG India Credit Co. Ltd.');
    expect(html).toContain('PRC016780178');
    expect(html).toContain('Asha Shah');
    expect(html).toContain('Noto Sans Gujarati');
    expect(html).toContain('રાખનારનું નામ');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('(એ) કુલ રૂપિયા');
    expect(html).toContain('11800');
    if (
      code === 'form5-jamnagar-gandhidham' ||
      code === 'form5-kapadwanj' ||
      code === 'form5-mehsana' ||
      code === 'form5-navsari' ||
      code === 'form5-surendranagar'
    ) {
      expect(html).toContain('અધિકૃત સહી');
      if (code === 'form5-mehsana') {
        expect(html).toContain('મહેસાણા મહાનગરપાલિકા');
        expect(html).toContain('class="mmc-header-img"');
      } else {
        expect(html).toContain('નમૂનો-૫');
      }
    } else {
      expect(html).toContain('સહી:');
      expect(html).toContain('નમુનો-૫');
    }
  });

  test('form5-jamnagar-gandhidham follows reviewed Gujarati layout with general stamp', async () => {
    const buffer = await readBundledTemplateBuffer('form5-jamnagar-gandhidham');
    const source = buffer.toString('utf8');
    expect(source).toContain('class="page page-2"');
    expect(source).toContain('{{> employee-list-general}}');
    expect(source).toContain('(પાછળ જુઓ)');
    expect(source).toContain('{{periodMonthLabel}}');
    expect(source).toContain('{{rcNumber}}');
    expect(source).toContain('{{employerName}}');
    expect(source).toContain('{{place}}');
    expect(source).toContain('{{filingDate}}');
    expect(source).toContain('font-size: 22px');
    expect(source).toContain('font-size: 20px');
    expect(source).not.toContain('#FFFF00');
    expect(source).not.toContain('{{paymentDate}}');
    expect(source).not.toContain('{{receiptNumber}}');

    const html = await fillHtmlTemplate(source, sampleForm5PreviewValues());
    expect(html).toContain('નમૂનો-૫');
    expect(html).toContain('કામે રાખનારનું નામ');
    expect(html).toContain('ભરવાપાત્ર કુલ વેરો');
    expect(html).toContain('For ');
    expect(html).toContain('અધિકૃત સહી');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('class="footer-row"');
    expect(html).toContain('class="hoddo-line"');
    expect(html).toContain('class="employer-name-line"');
    expect(html).toContain('સ્થળ:');
    expect(html).toContain('class="employee-page"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('Authorized Signatory');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('Professional Tax for the Month of');
  });

  test('form5-kapadwanj follows Jamnagar layout with Kapadwanj Word wording', async () => {
    const buffer = await readBundledTemplateBuffer('form5-kapadwanj');
    const source = buffer.toString('utf8');
    expect(source).toContain('Kapadwanj Form-5 Template');
    expect(source).toContain('class="page page-2"');
    expect(source).toContain('{{> employee-list-general}}');
    expect(source).toContain('(પાછળ જુઓ)');
    expect(source).toContain('{{periodFrom}} TO {{periodTo}}');
    expect(source).not.toContain('Dt.:');
    expect(source).not.toContain('#FFFF00');
    expect(source).not.toContain('{{paymentDate}}');
    expect(source).not.toContain('{{receiptNumber}}');
    expect(source).not.toContain('{{> gujarati-form-core}}');

    const html = await fillHtmlTemplate(source, sampleForm5PreviewValues());
    expect(html).toContain('નમૂનો-૫');
    expect(html).toContain('કામે રાખનારનું નામ');
    expect(html).toContain('ભરવાપાત્ર કુલ વેરો');
    expect(html).toContain('For ');
    expect(html).toContain('અધિકૃત સહી');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('class="footer-row"');
    expect(html).toContain('class="hoddo-line"');
    expect(html).toContain('class="employer-name-line"');
    expect(html).toContain('સ્થળ:');
    expect(html).toContain('class="employee-page"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('Authorized Signatory');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('Professional Tax for the Month of');
  });

  test('form5-mehsana uses municipal header image on Jamnagar layout', async () => {
    const buffer = await readBundledTemplateBuffer('form5-mehsana');
    const source = buffer.toString('utf8');
    expect(source).toContain('Mehsana Form-5 Template');
    expect(source).toContain('class="mmc-header"');
    expect(source).toContain('{{mehsanaHeaderImageSrc}}');
    expect(source).toContain('class="page page-2"');
    expect(source).toContain('{{> employee-list-general}}');
    expect(source).toContain('(પાછળ જુઓ)');
    expect(source).toContain('month-left');
    expect(source).not.toContain('{{> gujarati-form-core}}');
    expect(source).not.toContain('#FFFF00');
    expect(source).not.toContain('{{paymentDate}}');
    expect(source).not.toContain('{{receiptNumber}}');

    const html = await fillHtmlTemplate(source, sampleForm5PreviewValues());
    expect(html).toContain('મહેસાણા મહાનગરપાલિકા');
    expect(html).toContain('class="mmc-header-img"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('કામે રાખનારનું નામ');
    expect(html).toContain('ભરવાપાત્ર કુલ વેરો');
    expect(html).toContain('For ');
    expect(html).toContain('અધિકૃત સહી');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('class="footer-row"');
    expect(html).toContain('સ્થળ:');
    expect(html).toContain('class="employee-page"');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('Authorized Signatory');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('Professional Tax for the Month of');
  });

  test('form5-navsari follows Jamnagar layout with Navsari month wording', async () => {
    const buffer = await readBundledTemplateBuffer('form5-navsari');
    const source = buffer.toString('utf8');
    expect(source).toContain('Navsari Form-5 Template');
    expect(source).toContain('તારીખે પૂર્ણ થતા મહિના માટે ભરવાના વેરાનું પત્રક');
    expect(source).toContain('month-navsari');
    expect(source).toContain('class="page page-2"');
    expect(source).toContain('{{> employee-list-general}}');
    expect(source).toContain('(પાછળ જુઓ)');
    expect(source).not.toContain('{{> gujarati-form-core}}');
    expect(source).not.toContain('#FFFF00');
    expect(source).not.toContain('{{paymentDate}}');
    expect(source).not.toContain('{{receiptNumber}}');

    const html = await fillHtmlTemplate(source, sampleForm5PreviewValues());
    expect(html).toContain('નમૂનો-૫');
    expect(html).toContain('તારીખે પૂર્ણ થતા મહિના માટે ભરવાના વેરાનું પત્રક');
    expect(html).toContain('કામે રાખનારનું નામ');
    expect(html).toContain('ભરવાપાત્ર કુલ વેરો');
    expect(html).toContain('For ');
    expect(html).toContain('અધિકૃત સહી');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('class="footer-row"');
    expect(html).toContain('સ્થળ:');
    expect(html).toContain('class="employee-page"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('Authorized Signatory');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('Professional Tax for the Month of');
  });

  test('form5-surendranagar follows Jamnagar layout with period heading', async () => {
    const buffer = await readBundledTemplateBuffer('form5-surendranagar');
    const source = buffer.toString('utf8');
    expect(source).toContain('Surendranagar Form-5 Template');
    expect(source).toContain('તા.');
    expect(source).toContain('નું વ્ય. વેરો વેરાનું પત્રક');
    expect(source).toContain('month-surendranagar');
    expect(source).toContain('{{periodFrom}}');
    expect(source).toContain('{{periodTo}}');
    expect(source).toContain('class="page page-2"');
    expect(source).toContain('{{> employee-list-general}}');
    expect(source).toContain('(પાછળ જુઓ)');
    expect(source).not.toContain('{{> gujarati-form-core}}');
    expect(source).not.toContain('#FFFF00');
    expect(source).not.toContain('{{paymentDate}}');
    expect(source).not.toContain('{{receiptNumber}}');

    const html = await fillHtmlTemplate(source, sampleForm5PreviewValues());
    expect(html).toContain('નમૂનો-૫');
    expect(html).toContain('નું વ્ય. વેરો વેરાનું પત્રક');
    expect(html).toContain('કામે રાખનારનું નામ');
    expect(html).toContain('ભરવાપાત્ર કુલ વેરો');
    expect(html).toContain('For ');
    expect(html).toContain('અધિકૃત સહી');
    expect(html).toContain('હોદ્દો:');
    expect(html).toContain('class="footer-row"');
    expect(html).toContain('સ્થળ:');
    expect(html).toContain('class="employee-page"');
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toContain('CH-12345');
    expect(html).not.toContain('Authorized Signatory');
    expect(html).not.toContain('#FFFF00');
    expect(html).toContain('Professional Tax for the Month of');
  });

  test('bundled stored path convention', () => {
    expect(bundledStoredPath('form5-general')).toBe('bundled:form5-general');
  });

  test('official slab placeholders map by salary band', () => {
    const flat = flattenValuesForHandlebars(sampleForm5PreviewValues());
    expect(resolveOfficialSlabRows(sampleForm5PreviewValues().slabs)).toHaveLength(
      5,
    );
    expect(flat.slab5_no_emp).toBe(59);
    expect(flat.slab5_amount).toBe(11800);
    expect(flat.slab1_no_emp).toBe('');
    expect(flat.totalB).toBe('NIL');
    expect(flat.interest).toBe('NIL');
    expect(flat.totalTax).toBe(11800);
  });
});
