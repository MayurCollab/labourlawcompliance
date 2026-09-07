import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import config from './config/index.js';
import swaggerSpec, { swaggerUiOptions } from './config/swagger.js';
import apiCacheControl from './middleware/cacheControl.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import httpLogger from './middleware/httpLogger.js';
import mongoSanitizeMiddleware from './middleware/mongoSanitize.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import requestId from './middleware/requestId.js';
import { serveUploadMiddleware } from './middleware/serveUpload.js';
import { metricsMiddleware, registry } from './observability/metrics.js';
import { sentryEnabled, Sentry } from './observability/sentry.js';
import v1Router from './routes/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(requestId);
app.use(metricsMiddleware);
app.use(httpLogger);

/**
 * Helmet with explicit production-hardening headers.
 *
 * CSP:
 *   default-src 'self'
 *   base-uri 'self'
 *   frame-ancestors 'none'
 *   object-src 'none'
 *   img-src 'self' data: blob: (avatars + data URIs)
 *   style-src 'self' 'unsafe-inline' (Swagger UI needs inline styles when enabled)
 *   script-src 'self'
 *   connect-src 'self' <CLIENT_URL>
 *   form-action 'self'
 *   upgrade-insecure-requests (production only)
 *
 * HSTS: max-age=15552000 (180 days), includeSubDomains — production only
 * X-Content-Type-Options: nosniff
 * Referrer-Policy: no-referrer
 * Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
 * Cross-Origin-Resource-Policy: cross-origin (frontend may load /uploads images)
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", ...config.corsOrigins],
        formAction: ["'self'"],
        ...(config.isProduction
          ? { upgradeInsecureRequests: [] }
          : { upgradeInsecureRequests: null }),
      },
    },
    hsts: config.isProduction
      ? { maxAge: 15_552_000, includeSubDomains: true, preload: false }
      : false,
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const normalized = origin.replace(/\/$/, '');
      if (config.corsOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }),
);
app.use(
  compression({
    filter: (req, res) => {
      if (
        (req.path.endsWith('/import') ||
          req.path.endsWith('/bulk-generate')) &&
        (req.query.stream === '1' || req.query.stream === 'true')
      ) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(mongoSanitizeMiddleware);
app.use(cookieParser());

app.use(globalLimiter);

/**
 * Prometheus scrape endpoint. Registered before the rate limiter would matter
 * and outside /api/v1 by convention. Off unless METRICS_ENABLED=true, and
 * optionally protected by a shared bearer token, because request-path metrics
 * leak traffic shape if exposed publicly.
 */
if (config.metrics.enabled) {
  app.get('/metrics', async (req, res) => {
    if (
      config.metrics.token &&
      req.headers.authorization !== `Bearer ${config.metrics.token}`
    ) {
      return res.status(401).type('text/plain').send('Unauthorized');
    }

    res.setHeader('Content-Type', registry.contentType);
    return res.send(await registry.metrics());
  });
}

// Controlled upload delivery (not a browsable static mount)
app.use('/uploads', serveUploadMiddleware);

if (config.enableSwagger) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  );
}

app.use('/api/v1', apiCacheControl, v1Router);

app.use(notFound);

if (sentryEnabled) {
  // Captures anything that reached the error pipeline, before our handler
  // turns it into a client-safe JSON body
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

export default app;
