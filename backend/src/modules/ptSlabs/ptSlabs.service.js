import AppError from '../../utils/AppError.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import { PT_SLABS_CODES } from './ptSlabs.constants.js';
import { toPtSlabDto, toPtSlabListDto } from './ptSlabs.dto.js';
import * as ptSlabsRepository from './ptSlabs.repository.js';

const endOrInf = (value) =>
  value === null || value === undefined ? Number.POSITIVE_INFINITY : value;

const dateEndOrInf = (value) =>
  value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

const salaryRangesOverlap = (aFrom, aTo, bFrom, bTo) =>
  aFrom <= endOrInf(bTo) && bFrom <= endOrInf(aTo);

const effectiveWindowsOverlap = (aFrom, aTo, bFrom, bTo) =>
  new Date(aFrom).getTime() <= dateEndOrInf(bTo) &&
  new Date(bFrom).getTime() <= dateEndOrInf(aTo);

const defaultLabel = (salaryFrom, salaryTo) => {
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  if (salaryTo === null || salaryTo === undefined) {
    return `Rs. ${fmt(salaryFrom)} and above`;
  }
  return `Rs. ${fmt(salaryFrom)} – ${fmt(salaryTo)}`;
};

const findSlabOrFail = async (id) => {
  const slab = await ptSlabsRepository.findPtSlabById(id);
  if (!slab) {
    throw new AppError('PT slab not found', 404, {
      code: PT_SLABS_CODES.SLAB_NOT_FOUND,
    });
  }
  return slab;
};

const assertRange = (salaryFrom, salaryTo) => {
  if (salaryTo !== null && salaryTo !== undefined && salaryTo < salaryFrom) {
    throw new AppError('salaryTo must be greater than or equal to salaryFrom', 422, {
      code: PT_SLABS_CODES.INVALID_RANGE,
    });
  }
};

const assertNoOverlap = async (candidate, excludeId = null) => {
  const others = await ptSlabsRepository.findPtSlabs({});
  const clash = others.find((other) => {
    if (excludeId && String(other.id) === String(excludeId)) return false;
    if (
      !effectiveWindowsOverlap(
        candidate.effectiveFrom,
        candidate.effectiveTo,
        other.effectiveFrom,
        other.effectiveTo,
      )
    ) {
      return false;
    }
    return salaryRangesOverlap(
      candidate.salaryFrom,
      candidate.salaryTo,
      other.salaryFrom,
      other.salaryTo,
    );
  });

  if (clash) {
    throw new AppError(
      `This range overlaps an existing slab (${clash.label || 'untitled'})`,
      409,
      { code: PT_SLABS_CODES.SLAB_OVERLAP },
    );
  }
};

const currentlyEffectiveFilter = (at) => {
  const when = at ?? new Date();
  return {
    effectiveFrom: { $lte: when },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: when } }],
  };
};

export const listEffectiveSlabs = async (at = new Date()) => {
  const filter = currentlyEffectiveFilter(at);
  return ptSlabsRepository.findPtSlabs(filter);
};

export const listPtSlabs = async (query = {}) => {
  const slabs = await listEffectiveSlabs(query.at);
  return toPtSlabListDto(slabs);
};

export const getPtSlab = async (id) => {
  const slab = await findSlabOrFail(id);
  return toPtSlabDto(slab);
};

export const createPtSlab = async (data, actorId) => {
  const salaryTo = data.salaryTo ?? null;
  assertRange(data.salaryFrom, salaryTo);

  const payload = {
    salaryFrom: data.salaryFrom,
    salaryTo,
    rate: data.rate,
    label: sanitizeUserHtml(data.label || defaultLabel(data.salaryFrom, salaryTo)),
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
    sortOrder: data.sortOrder ?? data.salaryFrom,
    createdBy: actorId,
  };

  await assertNoOverlap(payload);

  const slab = await ptSlabsRepository.createPtSlab(payload);

  await recordActivity({
    action: ACTIVITY_ACTIONS.PT_SLAB_CREATE,
    entityType: ENTITY_TYPES.PT_SLAB,
    entityId: slab.id,
    changes: {
      salaryFrom: payload.salaryFrom,
      salaryTo: payload.salaryTo,
      rate: payload.rate,
    },
  });

  return toPtSlabDto(slab);
};

export const updatePtSlab = async (id, data, actorId) => {
  const slab = await findSlabOrFail(id);

  if (data.salaryFrom !== undefined) slab.salaryFrom = data.salaryFrom;
  if (data.salaryTo !== undefined) slab.salaryTo = data.salaryTo;
  if (data.rate !== undefined) slab.rate = data.rate;
  if (data.effectiveFrom !== undefined) slab.effectiveFrom = data.effectiveFrom;
  if (data.effectiveTo !== undefined) slab.effectiveTo = data.effectiveTo;
  if (data.sortOrder !== undefined) slab.sortOrder = data.sortOrder;
  if (data.label !== undefined) {
    slab.label = sanitizeUserHtml(data.label);
  } else if (data.salaryFrom !== undefined || data.salaryTo !== undefined) {
    slab.label = defaultLabel(slab.salaryFrom, slab.salaryTo);
  }

  assertRange(slab.salaryFrom, slab.salaryTo);
  await assertNoOverlap(
    {
      salaryFrom: slab.salaryFrom,
      salaryTo: slab.salaryTo,
      effectiveFrom: slab.effectiveFrom,
      effectiveTo: slab.effectiveTo,
    },
    id,
  );

  slab.updatedBy = actorId;
  await ptSlabsRepository.savePtSlab(slab);

  await recordActivity({
    action: ACTIVITY_ACTIONS.PT_SLAB_UPDATE,
    entityType: ENTITY_TYPES.PT_SLAB,
    entityId: slab.id,
    changes: { salaryFrom: slab.salaryFrom, salaryTo: slab.salaryTo, rate: slab.rate },
  });

  return toPtSlabDto(slab);
};

export const deletePtSlab = async (id, actorId) => {
  const slab = await findSlabOrFail(id);
  await slab.softDelete(actorId);

  await recordActivity({
    action: ACTIVITY_ACTIONS.PT_SLAB_SOFT_DELETE,
    entityType: ENTITY_TYPES.PT_SLAB,
    entityId: slab.id,
    changes: { label: slab.label, salaryFrom: slab.salaryFrom },
  });
};
