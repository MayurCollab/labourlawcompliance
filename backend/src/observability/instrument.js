import { initSentry } from './sentry.js';

/**
 * Side-effect module: must be the FIRST import in server.js so Sentry can
 * patch http/express/mongoose before those modules are loaded.
 */
initSentry();
