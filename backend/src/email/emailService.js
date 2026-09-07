import config from '../config/index.js';
import { APP_NAME } from '../constants/app.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';
import { enqueueEmail } from './emailQueue.js';
import renderTemplate from './renderTemplate.js';
import layout from './templates/layout.js';
import * as resetPasswordTemplate from './templates/resetPassword.js';
import * as verifyEmailTemplate from './templates/verifyEmail.js';

const renderEmail = (content, variables) =>
  renderTemplate(layout, {
    appName: APP_NAME,
    year: new Date().getFullYear(),
    content: renderTemplate(content, variables),
  });

/**
 * Queue a verification email (never blocks registration on SMTP).
 * Enqueue failures are logged by the caller — registration still succeeds.
 */
export const sendVerificationEmail = async ({
  to,
  name,
  verificationUrl,
  userId = null,
}) => {
  const html = renderEmail(verifyEmailTemplate.content, {
    name: escapeHtml(name),
    verificationUrl: sanitizeUrl(verificationUrl),
    expiryHours: Math.round(config.auth.emailVerificationExpiryMin / 60),
  });

  return enqueueEmail({
    to,
    subject: verifyEmailTemplate.subject,
    html,
    template: 'verify-email',
    userId,
    meta: { kind: 'verify-email' },
  });
};

export const sendPasswordResetEmail = async ({
  to,
  name,
  resetUrl,
  userId = null,
}) => {
  const html = renderEmail(resetPasswordTemplate.content, {
    name: escapeHtml(name),
    resetUrl: sanitizeUrl(resetUrl),
    expiryMinutes: config.auth.passwordResetExpiryMin,
  });

  return enqueueEmail({
    to,
    subject: resetPasswordTemplate.subject,
    html,
    template: 'reset-password',
    userId,
    meta: { kind: 'reset-password' },
  });
};
