import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { EMPLOYEES_MESSAGES } from './employees.constants.js';
import * as employeesService from './employees.service.js';

export const listEmployees = asyncHandler(async (req, res) => {
  const result = await employeesService.listEmployees(req.query);
  return sendSuccess(res, result, EMPLOYEES_MESSAGES.FETCHED);
});

export const lookupEmployee = asyncHandler(async (req, res) => {
  const employee = await employeesService.findEmployeeForLookup(req.query);
  return sendSuccess(res, { employee }, EMPLOYEES_MESSAGES.FETCHED);
});

export const getEmployee = asyncHandler(async (req, res) => {
  const employee = await employeesService.getEmployee(req.params.id);
  return sendSuccess(res, { employee }, EMPLOYEES_MESSAGES.FETCHED);
});

export const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeesService.createEmployee(
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { employee }, EMPLOYEES_MESSAGES.CREATED, 201);
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeesService.updateEmployee(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { employee }, EMPLOYEES_MESSAGES.UPDATED);
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  await employeesService.deleteEmployee(req.params.id, req.user.id);
  return sendSuccess(res, null, EMPLOYEES_MESSAGES.DELETED);
});
