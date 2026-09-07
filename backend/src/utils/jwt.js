import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import config from '../config/index.js';

/**
 * JWT helpers — the ONLY place tokens are signed/verified so secrets and
 * expiry settings live in one spot. Used by the auth service and the
 * authenticate middleware.
 */

export const signAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiry });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);

/** Include a unique `jti` so two refreshes in the same second never collide. */
export const signRefreshToken = (payload) =>
  jwt.sign(
    { ...payload, jti: randomUUID() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry },
  );

export const verifyRefreshToken = (token) =>
  jwt.verify(token, config.jwt.refreshSecret);

/** Decode without verifying (e.g. to read `exp` after signing). */
export const decodeToken = (token) => jwt.decode(token);
