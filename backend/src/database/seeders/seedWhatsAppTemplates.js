import config from '../../config/index.js';
import WhatsAppTemplate from '../../modules/whatsappTemplates/whatsappTemplate.model.js';
import * as whatsappTemplatesRepository from '../../modules/whatsappTemplates/whatsappTemplates.repository.js';
import logger from '../../utils/logger.js';

/**
 * Migrates the previously hardcoded MSG91 template (config.msg91) into a
 * WhatsApp template record. Variables mirror what the old sender posted:
 * body_1 recipient name, body_2 month, body_3 year.
 * Created once; a record an admin edited or deleted is never overwritten.
 */
export const seedWhatsAppTemplates = async () => {
  const existing = await whatsappTemplatesRepository.findSeededWhatsAppTemplate();
  if (existing) {
    logger.info(
      `[seed] WhatsApp template already seeded${existing.isDeleted ? ' (deleted by admin — skipped)' : ''}`,
    );
    return;
  }

  const { templateName, templateNamespace, templateLanguage } = config.msg91;

  await WhatsAppTemplate.create({
    label: 'Form 5 reminder',
    msg91TemplateName: templateName,
    namespace: templateNamespace,
    languageCode: templateLanguage,
    bodyPreview:
      'Hii {{RecipientName}}, Please find above Form-5 and Salary details of Professional Tax for the Month of {{MonthOfForm5}}, Please deposit the same on or before due date.',
    variables: [
      { field: 'recipientName' },
      { field: 'month' },
      { field: 'year' },
    ],
    isActive: true,
    isSeeded: true,
  });

  logger.info(`[seed] WhatsApp template seeded: ${templateName}`);
};
