/**
 * Normalised route label for a handled request, e.g. `/api/v1/users/:id`.
 *
 * `req.route` is only populated once Express has matched a handler, so this
 * must be called after the response finishes. Falling back to the raw path
 * would explode Prometheus label cardinality (one series per user id), so
 * unmatched requests collapse into a single `unmatched` bucket.
 */
export const getRouteLabel = (req) => {
  const routePath = req.route?.path;

  if (!routePath) {
    return 'unmatched';
  }

  const base = req.baseUrl || '';
  const suffix = routePath === '/' ? '' : routePath;

  return `${base}${suffix}` || '/';
};

export default getRouteLabel;
