import nodemailer from 'nodemailer';

import config from '../config/index.js';

/** Shared nodemailer transporter configured from SMTP_* env vars. */
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth:
    config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  // Fail fast in dev when no real SMTP server is configured
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
});

export default transporter;
