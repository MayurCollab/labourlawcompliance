import * as Sentry from '@sentry/node';

import config from '../config/index.js';

/** Field names that must never leave the process in an error payload. */
const SENSITIVE_KEYS = [
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'csrftoken',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'jwt',
  'apikey',
  'api_key',
  'otp',
  'passwordresettoken',
  'emailverificationtoken',
];

const REDACTED = '[redacted]';

const isSensitive = (key) =>
  SENSITIVE_KEYS.includes(String(key).toLowerCase().replace(/[-_]/g, ''));

/**
 * Deep-clones a payload, replacing any sensitive-looking value with a marker.
 * Depth-capped so a cyclic or huge object can't stall the send path.
 */
export const scrub = (value, depth = 0) => {
  if (depth > 6 || value == null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        isSensitive(key) ? REDACTED : scrub(val, depth + 1),
      ]),
    );
  }

  return value;
};

const scrubEvent = (event) => {
  if (event.request) {
    if (event.request.data) event.request.data = scrub(event.request.data);
    if (event.request.headers) {
      event.request.headers = scrub(event.request.headers);
    }
    if (event.request.cookies) event.request.cookies = REDACTED;
    // Query strings can carry reset/verification tokens
    if (event.request.query_string) event.request.query_string = REDACTED;
  }

  if (event.extra) event.extra = scrub(event.extra);
  if (event.contexts) event.contexts = scrub(event.contexts);
  if (event.user) {
    // Keep the id for triage, drop everything else
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  return event;
};

export const sentryEnabled = Boolean(config.sentry.dsn);

/**
 * Must be called before Express (and any instrumented library) is imported —
 * see src/observability/instrument.js. No-ops when SENTRY_DSN is unset, which
 * is the default for local development.
 */
export const initSentry = () => {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    release: config.sentry.release,
    tracesSampleRate: config.sentry.tracesSampleRate,
    // Never auto-attach IPs, cookies or request bodies
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.data) breadcrumb.data = scrub(breadcrumb.data);
      return breadcrumb;
    },
  });
};

export { Sentry };
