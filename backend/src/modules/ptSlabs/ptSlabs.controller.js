import asyncHandler from '../../middleware/asyncHandler.js';
import { sendSuccess } from '../../utils/responseFormatter.js';
import { PT_SLABS_MESSAGES } from './ptSlabs.constants.js';
import * as ptSlabsService from './ptSlabs.service.js';

export const listPtSlabs = asyncHandler(async (req, res) => {
  const slabs = await ptSlabsService.listPtSlabs(req.query);
  return sendSuccess(res, { slabs }, PT_SLABS_MESSAGES.FETCHED);
});

export const getPtSlab = asyncHandler(async (req, res) => {
  const slab = await ptSlabsService.getPtSlab(req.params.id);
  return sendSuccess(res, { slab }, PT_SLABS_MESSAGES.FETCHED);
});

export const createPtSlab = asyncHandler(async (req, res) => {
  const slab = await ptSlabsService.createPtSlab(req.body, req.user.id);
  return sendSuccess(res, { slab }, PT_SLABS_MESSAGES.CREATED, 201);
});

export const updatePtSlab = asyncHandler(async (req, res) => {
  const slab = await ptSlabsService.updatePtSlab(
    req.params.id,
    req.body,
    req.user.id,
  );
  return sendSuccess(res, { slab }, PT_SLABS_MESSAGES.UPDATED);
});

export const deletePtSlab = asyncHandler(async (req, res) => {
  await ptSlabsService.deletePtSlab(req.params.id, req.user.id);
  return sendSuccess(res, null, PT_SLABS_MESSAGES.DELETED);
});
