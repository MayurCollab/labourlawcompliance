import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { UPLOADS_MESSAGES } from './uploads.constants.js';
import * as uploadsService from './uploads.service.js';

export const listUploads = asyncHandler(async (req, res) => {
  const result = await uploadsService.listUploads(req.query);
  return sendSuccess(res, result, UPLOADS_MESSAGES.FETCHED);
});

export const getUpload = asyncHandler(async (req, res) => {
  const upload = await uploadsService.getUpload(req.params.id);
  return sendSuccess(res, { upload }, UPLOADS_MESSAGES.FETCHED);
});

export const createUpload = asyncHandler(async (req, res) => {
  const upload = await uploadsService.createUpload(
    { file: req.file, kind: req.body.kind },
    req.user.id,
  );
  return sendSuccess(res, { upload }, UPLOADS_MESSAGES.CREATED, 201);
});

export const previewUpload = asyncHandler(async (req, res) => {
  const upload = await uploadsService.previewUpload(req.params.id, req.body);
  return sendSuccess(res, { upload }, UPLOADS_MESSAGES.PREVIEWED);
});

export const listUploadRows = asyncHandler(async (req, res) => {
  const result = await uploadsService.listUploadRows(req.params.id, req.body);
  return sendSuccess(res, result, UPLOADS_MESSAGES.ROWS);
});

export const importUpload = asyncHandler(async (req, res) => {
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
      const result = await uploadsService.importUpload(
        req.params.id,
        req.body,
        req.user.id,
        (progress) => writeEvent({ type: 'progress', ...progress }),
      );
      writeEvent({ type: 'complete', data: result });
      return res.end();
    } catch (error) {
      const status = error.statusCode || 500;
      writeEvent({
        type: 'error',
        message: error.message || 'Import failed',
        code: error.code,
        status,
      });
      return res.status(status).end();
    }
  }

  const result = await uploadsService.importUpload(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, result, UPLOADS_MESSAGES.IMPORTED);
});

export const downloadImportErrors = asyncHandler(async (req, res) => {
  const { buffer, filename, mimetype } =
    await uploadsService.downloadImportErrors(req.params.id);
  res.setHeader('Content-Type', mimetype);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename.replace(/"/g, '')}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
});

export const purgeMasterData = asyncHandler(async (req, res) => {
  const result = await uploadsService.purgeMasterData(req.body, req.user.id);
  return sendSuccess(res, result, UPLOADS_MESSAGES.MASTER_PURGED);
});

export const purgeSalaryData = asyncHandler(async (req, res) => {
  const result = await uploadsService.purgeSalaryData(req.body, req.user.id);
  return sendSuccess(res, result, UPLOADS_MESSAGES.SALARY_PURGED);
});

export const purgeClientMasterData = asyncHandler(async (req, res) => {
  const result = await uploadsService.purgeClientMasterData(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, result, UPLOADS_MESSAGES.CLIENT_MASTER_PURGED);
});
