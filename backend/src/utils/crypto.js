import { createHash, randomBytes } from 'node:crypto';

/**
 * Helpers for single-use tokens (email verification, password reset).
 * The RAW token is sent to the user; only its SHA-256 hash is stored,
 * so a database leak never exposes usable tokens.
 */

export const generateRandomToken = (bytes = 32) =>
  randomBytes(bytes).toString('hex');

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');
