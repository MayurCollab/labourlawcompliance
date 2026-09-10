import config from '../../config/index.js';
import AppError from '../../utils/AppError.js';
import logger from '../../utils/logger.js';

/**
 * Send a WhatsApp template message with a document header via MSG91 bulk API.
 *
 * @param {{
 *   phone: string,
 *   filename: string,
 *   mediaUrl: string,
 *   companyName: string,
 *   monthName: string,
 *   year: string,
 * }} params
 */
export const sendForm5WhatsAppTemplate = async ({
  phone,
  filename,
  mediaUrl,
  companyName,
  monthName,
  year,
}) => {
  const {
    authKey,
    integratedNumber,
    templateName,
    templateNamespace,
    templateLanguage,
    apiUrl,
  } = config.msg91;

  if (!authKey) {
    throw new AppError('MSG91 WhatsApp is not configured (MSG91_AUTH_KEY).', 503, {
      code: 'MSG91_NOT_CONFIGURED',
    });
  }

  const body = {
    integrated_number: integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: templateLanguage,
          policy: 'deterministic',
        },
        namespace: templateNamespace,
        to_and_components: [
          {
            to: [phone],
            components: {
              header_1: {
                filename,
                type: 'document',
                value: mediaUrl,
              },
              body_1: {
                type: 'text',
                value: companyName || '',
              },
              body_2: {
                type: 'text',
                value: monthName || '',
              },
              body_3: {
                type: 'text',
                value: year || '',
              },
            },
          },
        ],
      },
    },
  };

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    logger.error('[msg91] WhatsApp request failed', { error: error.message });
    throw new AppError('Could not reach MSG91 WhatsApp API.', 502, {
      code: 'MSG91_REQUEST_FAILED',
    });
  }

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      payload?.errors?.[0]?.message ||
      `MSG91 WhatsApp send failed (${response.status})`;
    logger.warn('[msg91] WhatsApp send rejected', {
      status: response.status,
      payload,
    });
    throw new AppError(String(message), 502, {
      code: 'MSG91_SEND_FAILED',
    });
  }

  return payload;
};
