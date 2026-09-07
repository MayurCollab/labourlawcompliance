import AppError from '../../utils/AppError.js';
import {
  filledExtension,
  filledMimetype,
} from '../templates/templateFill.js';
import { FILINGS_CODES } from './filings.constants.js';
import { isPdfBuffer, renderForm5Pdf } from './htmlToPdf.js';
import { convertXlsxBufferToPdf } from './xlsxToPdf.js';
import logger from '../../utils/logger.js';

const PDF_MIMETYPE = 'application/pdf';

/**
 * Turn a filled template buffer into the stored Form 5 deliverable.
 * HTML templates always become A4 PDF; Excel tries LibreOffice first.
 */
export const resolveForm5OutputBuffer = async ({
  template,
  filled,
  filing,
  client,
}) => {
  const kind = template?.kind;

  if (kind === 'html') {
    const html = Buffer.isBuffer(filled)
      ? filled.toString('utf8')
      : String(filled ?? '');
    const pdf = await renderForm5Pdf({ html });
    if (!isPdfBuffer(pdf)) {
      throw new AppError(
        'Form 5 HTML did not render to a valid PDF.',
        422,
        { code: FILINGS_CODES.PDF_CONVERT_FAILED },
      );
    }
    return {
      buffer: pdf,
      ext: '.pdf',
      mimetype: PDF_MIMETYPE,
    };
  }

  if (kind === 'excel') {
    try {
      const pdf = await convertXlsxBufferToPdf(
        filled,
        `${filing?.clientCode || 'Form5'}_${filing?.period || 'period'}`,
      );
      return {
        buffer: pdf,
        ext: '.pdf',
        mimetype: PDF_MIMETYPE,
      };
    } catch (error) {
      if (error?.code !== FILINGS_CODES.PDF_CONVERTER_MISSING) throw error;
      logger.warn(
        'Form 5 PDF skipped — LibreOffice not found; storing filled Excel instead',
        {
          clientCode: filing?.clientCode,
          period: filing?.period,
          location: client?.location?.name,
        },
      );
      return {
        buffer: filled,
        ext: filledExtension(kind),
        mimetype: filledMimetype(kind),
      };
    }
  }

  return {
    buffer: filled,
    ext: filledExtension(kind),
    mimetype: filledMimetype(kind),
  };
};
