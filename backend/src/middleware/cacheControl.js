/**
 * Cache policy for the JSON API.
 *
 * Everything under /api/v1 is either user-scoped or mutable, and most of it is
 * behind a bearer token — a shared proxy or the browser's back/forward cache
 * holding on to it would leak one user's data to the next. So the API sends
 * `no-store` by default. A handler that returns genuinely public, stable data
 * can override the header before responding.
 *
 * Static uploads are handled separately in serveUpload.js (long max-age).
 */
const apiCacheControl = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Authorization, Origin');
  next();
};

export default apiCacheControl;
