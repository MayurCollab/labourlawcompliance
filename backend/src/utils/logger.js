import path from 'node:path';
import { fileURLToPath } from 'node:url';

import winston from 'winston';

import config from '../config/index.js';
import { getRequestContext } from './requestContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '..', 'logs');

/**
 * Injects the active request correlation fields (from AsyncLocalStorage)
 * into every log entry emitted while handling that request.
 */
const correlationFormat = winston.format((info) => {
  const ctx = getRequestContext();
  if (!ctx) return info;

  if (ctx.requestId) info.requestId = ctx.requestId;
  if (ctx.userId) info.userId = ctx.userId;
  if (ctx.route || ctx.path) info.route = ctx.route || ctx.path;
  if (ctx.method) info.method = ctx.method;

  return info;
});

const RESERVED = new Set([
  'timestamp',
  'level',
  'message',
  'requestId',
  'userId',
  'route',
  'method',
  'stack',
  Symbol.for('level'),
  Symbol.for('message'),
  Symbol.for('splat'),
]);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, route, method } =
      info;
    const rid = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    const who = userId ? ` user=${userId}` : '';
    const where = route ? ` ${method || ''} ${route}`.trimEnd() : '';

    const extras = Object.keys(info)
      .filter((key) => !RESERVED.has(key))
      .map((key) => `${key}=${JSON.stringify(info[key])}`)
      .join(' ');

    return `${timestamp} ${level}${rid}${where}${who} ${message}${
      extras ? ` ${extras}` : ''
    }`;
  }),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

/**
 * Production logs are JSON on stdout (so a log shipper can parse them) plus
 * rotating files. Development gets the human-readable console format.
 */
const transports = [
  new winston.transports.Console({
    format: config.isProduction ? jsonFormat : consoleFormat,
    level: config.isProduction ? 'info' : 'debug',
  }),
];

if (config.isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
      level: 'http',
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

const logger = winston.createLogger({
  level: config.isProduction ? 'http' : 'debug',
  silent: config.isTest && process.env.LOG_IN_TESTS !== 'true',
  format: winston.format.combine(
    correlationFormat(),
    winston.format.errors({ stack: true }),
  ),
  transports,
});

export default logger;
