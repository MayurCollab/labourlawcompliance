import client from 'prom-client';

import { getRouteLabel } from '../utils/routeLabel.js';

export const registry = new client.Registry();

registry.setDefaultLabels({ app: 'blueprint-mern-api' });

// Process/GC/event-loop metrics
client.collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled, labelled by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds, labelled by method, route and status code',
  labelNames: ['method', 'route', 'status'],
  // Tuned for a JSON API: most requests should land in the first few buckets
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being handled',
  registers: [registry],
});

export const mongoSlowQueriesTotal = new client.Counter({
  name: 'mongo_slow_queries_total',
  help: 'Mongoose operations that exceeded the slow-query threshold',
  labelNames: ['collection', 'operation'],
  registers: [registry],
});

export const emailJobsTotal = new client.Counter({
  name: 'email_jobs_total',
  help: 'Email jobs processed, labelled by outcome',
  labelNames: ['status'],
  registers: [registry],
});

/**
 * Records request count + latency per route.
 * Route labels come from the matched Express route (`/users/:id`), never the
 * raw path, to keep label cardinality bounded.
 */
export const metricsMiddleware = (req, res, next) => {
  const endTimer = httpRequestDurationSeconds.startTimer();
  httpRequestsInFlight.inc();

  res.on('finish', () => {
    httpRequestsInFlight.dec();

    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status: String(res.statusCode),
    };

    endTimer(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
};

export default registry;
