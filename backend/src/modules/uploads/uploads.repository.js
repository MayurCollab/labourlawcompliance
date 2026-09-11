import Upload from './upload.model.js';
import { UPLOAD_KINDS, UPLOAD_STATUSES } from './uploads.constants.js';

export const createUpload = (data) => Upload.create(data);

export const findUploads = (filter, { sort, skip, limit }) =>
  Upload.find(filter).sort(sort).skip(skip).limit(limit);

export const countUploads = (filter = {}) => Upload.countDocuments(filter);

export const findUploadById = (id) => Upload.findById(id);

/** Includes storedPath for re-reading the file on disk. */
export const findUploadByIdWithPath = (id) =>
  Upload.findById(id).select('+storedPath');

export const saveUpload = (upload, session = null) =>
  upload.save(session ? { session } : {});

/** Most recent successfully imported MasterSheet (clients + filings). */
export const findLatestImportedMaster = () =>
  Upload.findOne({
    kind: UPLOAD_KINDS.MASTER,
    status: UPLOAD_STATUSES.IMPORTED,
  }).sort({ updatedAt: -1, createdAt: -1 });
