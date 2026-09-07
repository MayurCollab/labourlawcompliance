import * as Sentry from '@sentry/react';

/**
 * Front-end error tracking.
 *
 * Disabled unless VITE_SENTRY_DSN is set, so local development and CI never
 * ship events anywhere. When it is set, request bodies, headers and URL query
 * strings are scrubbed before send — a password reset link in a breadcrumb is
 * a live credential.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const errorTrackingEnabled = Boolean(DSN);

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
  'secret',
  'otp',
];

const REDACTED = '[redacted]';

const isSensitive = (key: string) =>
  SENSITIVE_KEYS.includes(key.toLowerCase().replace(/[-_]/g, ''));

const scrub = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value == null) return value;

  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        isSensitive(key) ? REDACTED : scrub(val, depth + 1),
      ]),
    );
  }

  return value;
};

/** Strips `?token=...` style secrets out of any URL we report. */
const scrubUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.forEach((_v, key) => {
      if (isSensitive(key)) parsed.searchParams.set(key, REDACTED);
    });
    return parsed.toString();
  } catch {
    return url;
  }
};

export const initErrorTracking = () => {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
    ),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        if (event.request.data) event.request.data = scrub(event.request.data);
        if (event.request.headers) {
          event.request.headers = scrub(event.request.headers) as Record<
            string,
            string
          >;
        }
        if (event.request.url) event.request.url = scrubUrl(event.request.url);
        delete event.request.cookies;
        delete event.request.query_string;
      }

      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.user) {
        event.user = event.user.id ? { id: event.user.id } : {};
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = scrub(breadcrumb.data) as Record<string, unknown>;
        if (typeof breadcrumb.data.url === 'string') {
          breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
        }
      }
      return breadcrumb;
    },
  });
};

/** Associates subsequent events with a user id only — never name or email. */
export const setErrorTrackingUser = (userId: string | null) => {
  if (!errorTrackingEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
};

export const captureException = (
  error: unknown,
  context?: Record<string, unknown>,
) => {
  if (!errorTrackingEnabled) {
    // Without a DSN the console is the only sink; still surface it clearly
    console.error('[error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: scrub(context) as Record<string, unknown>,
  });
};
