import { randomUUID } from 'node:crypto';

import { requestContext } from '../utils/requestContext.js';

/**
 * Assigns a unique id to every request (honouring an incoming X-Request-Id
 * header from a proxy/gateway), exposes it on req.id and the X-Request-Id
 * response header, and runs the rest of the request inside the async
 * request context so every log line emitted during the request carries the
 * same correlation id, route and user id.
 */
const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  // Never trust an arbitrary-length header value into log lines
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);

  requestContext.run(
    {
      requestId: id,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 256) || null,
    },
    next,
  );
};

export default requestId;
