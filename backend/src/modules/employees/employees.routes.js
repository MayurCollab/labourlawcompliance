import { Router } from 'express';

import authenticate from '../../middleware/auth.js';
import checkPermission from '../../middleware/checkPermission.js';
import { userWriteLimiter } from '../../middleware/rateLimiter.js';
import validate from '../../middleware/validate.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { PERMISSION_NAMES } from '../permissions/permissions.constants.js';
import * as employeesController from './employees.controller.js';
import {
  createEmployeeSchema,
  employeeLookupQuerySchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from './employees.validation.js';

const router = Router();

router.use(authenticate);
router.use(userWriteLimiter);

/**
 * @openapi
 * /employees:
 *   get:
 *     tags: [Employees]
 *     summary: List employee month snapshots from salary ingest
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: period, schema: { type: string }, description: YYYY-MM }
 *       - { in: query, name: unmatched, schema: { type: string, enum: [true, false] } }
 */
router.get(
  '/',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_VIEW),
  validate({ query: listEmployeesQuerySchema }),
  employeesController.listEmployees,
);

/**
 * @openapi
 * /employees/lookup:
 *   get:
 *     tags: [Employees]
 *     summary: Look up an employee-month row by Employee No, Client and Period (for Add Employee autofill)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: employeeNo, required: true, schema: { type: string } }
 *       - { in: query, name: clientId, required: true, schema: { type: string } }
 *       - { in: query, name: period, required: true, schema: { type: string }, description: YYYY-MM }
 *     responses:
 *       200:
 *         description: Matching employee-month row, or null when none exists
 */
router.get(
  '/lookup',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_VIEW),
  validate({ query: employeeLookupQuerySchema }),
  employeesController.lookupEmployee,
);

/**
 * @openapi
 * /employees:
 *   post:
 *     tags: [Employees]
 *     summary: Add an employee-month row by hand
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, employeeNo, period]
 *             properties:
 *               clientId: { type: string }
 *               employeeNo: { type: string }
 *               employeeName: { type: string }
 *               period: { type: string, example: '2026-09' }
 *               ptGross: { type: number }
 *     responses:
 *       201:
 *         description: Employee row created
 *       409:
 *         description: An employee already exists for this Employee No, client and period
 */
router.post(
  '/',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_CREATE),
  validate({ body: createEmployeeSchema }),
  employeesController.createEmployee,
);

/**
 * @openapi
 * /employees/{id}:
 *   get:
 *     tags: [Employees]
 *     summary: Get an employee-month row by id
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/:id',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_VIEW),
  validate({ params: idParamSchema }),
  employeesController.getEmployee,
);

/**
 * @openapi
 * /employees/{id}:
 *   patch:
 *     tags: [Employees]
 *     summary: Edit an employee-month row
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/:id',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_EDIT),
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  employeesController.updateEmployee,
);

/**
 * @openapi
 * /employees/{id}:
 *   delete:
 *     tags: [Employees]
 *     summary: Soft-delete an employee-month row
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/:id',
  checkPermission(PERMISSION_NAMES.EMPLOYEES_DELETE),
  validate({ params: idParamSchema }),
  employeesController.deleteEmployee,
);

export default router;
