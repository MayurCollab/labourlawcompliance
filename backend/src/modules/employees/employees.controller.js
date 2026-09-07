import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { EMPLOYEES_MESSAGES } from './employees.constants.js';
import * as employeesService from './employees.service.js';

export const listEmployees = asyncHandler(async (req, res) => {
  const result = await employeesService.listEmployees(req.query);
  return sendSuccess(res, result, EMPLOYEES_MESSAGES.FETCHED);
});
