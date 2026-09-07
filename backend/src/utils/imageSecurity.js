import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

import AppError from './AppError.js';

const ALLOWED = new Map([
  ['image/jpeg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
  ['image/gif', 'image/gif'],
]);

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Validate an upload by magic bytes (not client mimetype), enforce size,
 * and re-encode with sharp to strip EXIF / other metadata.
 */
export const validateAndProcessImage = async (buffer, _claimedMime) => {
  if (!buffer?.length) {
    throw new AppError('An image file is required', 422, {
      code: 'FILE_REQUIRED',
    });
  }

  if (buffer.length > MAX_BYTES) {
    throw new AppError('File is too large (max 2 MB)', 422, {
      code: 'FILE_TOO_LARGE',
    });
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED.has(detected.mime)) {
    throw new AppError('Only JPEG, PNG, WEBP or GIF images are allowed', 422, {
      code: 'INVALID_FILE_TYPE',
    });
  }

  const mime = ALLOWED.get(detected.mime);

  // GIF: sharp re-encode can drop animation; still strips risky payloads.
  // rotate() applies EXIF orientation then discards metadata.
  let pipeline = sharp(buffer, { animated: mime === 'image/gif' }).rotate();

  if (mime === 'image/jpeg') {
    pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  } else if (mime === 'image/png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (mime === 'image/webp') {
    pipeline = pipeline.webp({ quality: 85 });
  } else if (mime === 'image/gif') {
    pipeline = pipeline.gif();
  }

  const cleaned = await pipeline.toBuffer();

  return { buffer: cleaned, mimetype: mime };
};

export const MAX_IMAGE_SIZE_BYTES = MAX_BYTES;
