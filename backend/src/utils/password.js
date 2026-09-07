import bcrypt from 'bcrypt';

import config from '../config/index.js';

/** Single place passwords are hashed/compared (cost factor from config). */

export const hashPassword = (password) =>
  bcrypt.hash(password, config.bcryptSaltRounds);

export const comparePassword = (password, hash) =>
  bcrypt.compare(password, hash);
