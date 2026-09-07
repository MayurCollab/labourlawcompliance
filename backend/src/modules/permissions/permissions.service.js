import { withTransaction } from '../../database/withTransaction.js';
import AppError from '../../utils/AppError.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import { PERMISSIONS_CODES } from './permissions.constants.js';
import {
  toGroupedPermissionsDto,
  toPermissionDto,
  toPermissionListDto,
} from './permissions.dto.js';
import * as permissionsRepository from './permissions.repository.js';

const findPermissionOrFail = async (id) => {
  const permission = await permissionsRepository.findPermissionById(id);
  if (!permission) {
    throw new AppError('Permission not found', 404, {
      code: PERMISSIONS_CODES.PERMISSION_NOT_FOUND,
    });
  }
  return permission;
};

const assertNameAvailable = async (name, excludeId = null) => {
  const existing = await permissionsRepository.findPermissionByName(name);
  if (existing && String(existing.id) !== String(excludeId)) {
    throw new AppError('A permission with this name already exists', 409, {
      code: PERMISSIONS_CODES.PERMISSION_NAME_IN_USE,
    });
  }
};

export const listPermissions = async ({ grouped = false } = {}) => {
  const permissions = await permissionsRepository.findAllPermissions();
  return grouped
    ? toGroupedPermissionsDto(permissions)
    : toPermissionListDto(permissions);
};

export const createPermission = async ({ name, description }, actorId) => {
  await assertNameAvailable(name);

  const permission = await permissionsRepository.createPermission({
    name: sanitizeUserHtml(name),
    module: sanitizeUserHtml(name.split('.')[0]),
    description: sanitizeUserHtml(description ?? ''),
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.PERMISSION_CREATE,
    entityType: ENTITY_TYPES.PERMISSION,
    entityId: permission.id,
    changes: { name: permission.name, module: permission.module },
  });

  return toPermissionDto(permission);
};

export const updatePermission = async (id, { name, description }, actorId) => {
  const permission = await findPermissionOrFail(id);

  if (name && name !== permission.name) {
    await assertNameAvailable(name, id);
    permission.name = sanitizeUserHtml(name);
    permission.module = sanitizeUserHtml(name.split('.')[0]);
  }
  if (description !== undefined) {
    permission.description = sanitizeUserHtml(description);
  }
  permission.updatedBy = actorId;

  const changedFields = permission
    .modifiedPaths()
    .filter((f) => f !== 'updatedBy');

  await withTransaction(async (session) => {
    await permissionsRepository.savePermission(permission, session);
    await recordActivity({
      action: ACTIVITY_ACTIONS.PERMISSION_UPDATE,
      entityType: ENTITY_TYPES.PERMISSION,
      entityId: permission.id,
      changes: { fields: changedFields },
      session,
    });
  });

  return toPermissionDto(permission);
};

/**
 * Deleting a permission touches every role that references it plus the
 * permission itself. Half-applied, a role keeps a dangling permission ref
 * that resolves to nothing — so all of it goes in one transaction.
 */
export const deletePermission = async (id, actorId) => {
  const permission = await findPermissionOrFail(id);

  await withTransaction(async (session) => {
    // Keep role documents consistent: drop the ref everywhere first
    const pulled = await permissionsRepository.pullPermissionFromRoles(
      permission.id,
      session,
    );
    await permission.softDelete(actorId, session ? { session } : {});

    await recordActivity({
      action: ACTIVITY_ACTIONS.PERMISSION_SOFT_DELETE,
      entityType: ENTITY_TYPES.PERMISSION,
      entityId: permission.id,
      changes: {
        name: permission.name,
        rolesUpdated: pulled.modifiedCount ?? 0,
      },
      session,
    });
  });
};
