import { Router } from 'express';

import {
  getHealth,
  getLiveness,
  getReadiness,
} from '../controllers/health.controller.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health summary (deprecated)
 *     description: >
 *       Legacy combined check kept for backwards compatibility.
 *       Prefer `/health/live` for liveness probes and `/health/ready` for
 *       readiness probes — they mean different things to an orchestrator.
 *     responses:
 *       200:
 *         description: Service is up
 */
router.get('/', getHealth);

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags:
 *       - Health
 *     summary: Liveness probe
 *     description: >
 *       Returns 200 whenever the process is running. Does not touch Mongo —
 *       a dependency outage must not trigger a container restart.
 *     responses:
 *       200:
 *         description: Process is alive
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: alive
 *                         environment:
 *                           type: string
 *                           example: development
 *                         uptime:
 *                           type: string
 *                           example: 42s
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 */
router.get('/live', getLiveness);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags:
 *       - Health
 *     summary: Readiness probe
 *     description: >
 *       Pings MongoDB. Returns 503 when the database is unreachable so the
 *       instance is pulled out of the load-balancer rotation.
 *     responses:
 *       200:
 *         description: All dependencies reachable
 *       503:
 *         description: A required dependency is unreachable
 */
router.get('/ready', getReadiness);

export default router;
