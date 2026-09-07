import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { FILINGS_MESSAGES } from './filings.constants.js';
import * as filingsService from './filings.service.js';

export const listFilings = asyncHandler(async (req, res) => {
  const result = await filingsService.listFilings(req.query);
  return sendSuccess(res, result, FILINGS_MESSAGES.FETCHED);
});

export const getFiling = asyncHandler(async (req, res) => {
  const filing = await filingsService.getFiling(req.params.id);
  return sendSuccess(res, { filing }, FILINGS_MESSAGES.FETCHED);
});

export const computeFiling = asyncHandler(async (req, res) => {
  const filing = await filingsService.computeFiling(req.params.id, req.user.id);
  return sendSuccess(res, { filing }, FILINGS_MESSAGES.COMPUTED);
});

export const updateFilingOverrides = asyncHandler(async (req, res) => {
  const filing = await filingsService.updateFilingOverrides(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { filing }, FILINGS_MESSAGES.OVERRIDES_UPDATED);
});

export const generateFiling = asyncHandler(async (req, res) => {
  const filing = await filingsService.generateFiling(
    req.params.id,
    req.user.id,
    { computeIfNeeded: Boolean(req.body?.computeIfNeeded) },
  );
  return sendSuccess(res, { filing }, FILINGS_MESSAGES.GENERATED);
});

export const bulkGenerateFilings = asyncHandler(async (req, res) => {
  const stream =
    req.query.stream === '1' ||
    req.query.stream === 'true' ||
    req.body.stream === true;

  if (stream) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (payload) => {
      if (!res.writableEnded) {
        res.write(`${JSON.stringify(payload)}\n`);
      }
    };

    try {
      const report = await filingsService.bulkGenerateFilings(
        req.body,
        req.user.id,
        (progress) => writeEvent({ type: 'progress', ...progress }),
      );
      writeEvent({ type: 'complete', data: report });
      return res.end();
    } catch (error) {
      const status = error.statusCode || 500;
      writeEvent({
        type: 'error',
        message: error.message || 'Bulk generate failed',
        code: error.code,
        status,
      });
      return res.status(status).end();
    }
  }

  const report = await filingsService.bulkGenerateFilings(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, report, FILINGS_MESSAGES.BULK_GENERATED);
});

export const downloadFiling = asyncHandler(async (req, res) => {
  const { buffer, filename, mimetype } = await filingsService.downloadGenerated(
    req.params.id,
    req.query.version,
  );
  res.setHeader('Content-Type', mimetype);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
});
