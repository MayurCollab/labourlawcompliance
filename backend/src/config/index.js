import 'dotenv/config';

/**
 * Central application config.
 * Reads every env var in one place and fails fast (with a clear message)
 * if a required variable is missing. No other file reads process.env directly.
 */

const REQUIRED_ENV_VARS = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[config] Missing required environment variable(s): ${missing.join(', ')}.\n` +
      '[config] Copy backend/.env.example to backend/.env and fill in the values.',
  );
  process.exit(1);
}

const env = process.env.NODE_ENV || 'development';
const storageDriver = process.env.STORAGE_DRIVER || 'local';

if (storageDriver === 's3') {
  const s3Required = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_BUCKET_NAME',
  ];
  const s3Missing = s3Required.filter((key) => {
    if (key === 'AWS_BUCKET_NAME') {
      return !process.env.AWS_BUCKET_NAME && !process.env.AWS_S3_BUCKET;
    }
    return !process.env[key];
  });
  if (s3Missing.length > 0) {
    console.error(
      `[config] STORAGE_DRIVER=s3 requires: ${s3Missing.join(', ')}.`,
    );
    process.exit(1);
  }
}

if (env === 'production' && !process.env.REDIS_URL) {
  console.warn(
    '[config] REDIS_URL is unset — using in-memory rate limits and inline email sends. Set REDIS_URL in production so limits are shared across processes and emails go through the queue.',
  );
}

const parseOriginList = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const corsOrigins = [
  ...parseOriginList(process.env.CLIENT_URL || 'http://localhost:5190'),
  ...parseOriginList(process.env.CORS_ORIGINS),
];

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  isDevelopment: env === 'development',
  isTest: env === 'test',

  port: Number(process.env.PORT) || 5000,
  /** Primary SPA origin (email links). First entry of CLIENT_URL. */
  clientUrl: corsOrigins[0] || 'http://localhost:5190',
  /** Allowed browser Origins for CORS (CLIENT_URL + optional CORS_ORIGINS). */
  corsOrigins,

  mongoUri: process.env.MONGO_URI,

  /** Redis for rate-limit store + BullMQ. Optional in development/test. */
  redisUrl: process.env.REDIS_URL || '',

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,

  auth: {
    // Minutes a fresh email-verification token stays valid
    emailVerificationExpiryMin:
      Number(process.env.EMAIL_VERIFICATION_EXPIRY_MIN) || 24 * 60,
    // Minutes a fresh password-reset token stays valid
    passwordResetExpiryMin:
      Number(process.env.PASSWORD_RESET_EXPIRY_MIN) || 15,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  email: {
    from:
      process.env.EMAIL_FROM ||
      'ACC Labour Law Compliance <no-reply@acclabourlaw.local>',
  },

  storage: {
    driver: storageDriver,
    s3: {
      region: process.env.AWS_REGION || '',
      bucket: process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  },

  /** Error tracking. Disabled entirely when SENTRY_DSN is unset. */
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  },

  /** Prometheus scrape endpoint. Off by default — enable only behind Prometheus. */
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    /** Optional shared secret; when set, /metrics requires this bearer token. */
    token: process.env.METRICS_TOKEN || '',
  },

  db: {
    /** Log any Mongoose operation slower than this (ms). 0 disables. */
    slowQueryMs: Number(process.env.DB_SLOW_QUERY_MS ?? 200),
  },

  /** When true, register/forgot responses include the raw token (e2e only). */
  exposeAuthTokens: process.env.EXPOSE_AUTH_TOKENS === 'true',

  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@1234',
  },

  /** Swagger UI at /api-docs — off in production unless explicitly enabled. */
  enableSwagger:
    process.env.ENABLE_SWAGGER === 'true' || env !== 'production',
});

export default config;
