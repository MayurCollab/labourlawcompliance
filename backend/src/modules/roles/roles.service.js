import { withTransaction } from '../../database/withTransaction.js';
import AppError from '../../utils/AppError.js';
import { sanitizeUserHtml } from '../../utils/sanitize.js';
import {
  ACTIVITY_ACTIONS,
  ENTITY_TYPES,
} from '../activity/activity.constants.js';
import { recordActivity } from '../activity/activity.service.js';
import * as permissionsRepository from '../permissions/permissions.repository.js';
import * as usersRepository from '../users/users.repository.js';
import { ROLES_CODES } from './roles.constants.js';
import { toRoleDto, toRoleListDto } from './roles.dto.js';
import * as rolesRepository from './roles.repository.js';

const findRoleOrFail = async (id) => {
  const role = await rolesRepository.findRoleById(id);
  if (!role) {
    throw new AppError('Role not found', 404, {
      code: ROLES_CODES.ROLE_NOT_FOUND,
    });
  }
  return role;
};

const assertNameAvailable = async (name, excludeId = null) => {
  const existing = await rolesRepository.findRoleByName(name);
  if (existing && String(existing.id) !== String(excludeId)) {
    throw new AppError('A role with this name already exists', 409, {
      code: ROLES_CODES.ROLE_NAME_IN_USE,
    });
  }
};

const assertPermissionsExist = async (permissionIds) => {
  const uniqueIds = [...new Set(permissionIds.map(String))];
  const count = await permissionsRepository.countPermissionsByIds(uniqueIds);
  if (count !== uniqueIds.length) {
    throw new AppError('One or more permission ids are invalid', 400, {
      code: ROLES_CODES.INVALID_PERMISSIONS,
    });
  }
  return uniqueIds;
};

export const listRoles = async () => {
  const roles = await rolesRepository.findAllRoles();
  return toRoleListDto(roles);
};

export const getRole = async (id) => {
  const role = await rolesRepository.findRoleByIdWithPermissions(id);
  if (!role) {
    throw new AppError('Role not found', 404, {
      code: ROLES_CODES.ROLE_NOT_FOUND,
    });
  }
  return toRoleDto(role);
};

export const createRole = async ({ name, description, permissions }, actorId) => {
  await assertNameAvailable(name);

  const permissionIds = permissions?.length
    ? await assertPermissionsExist(permissions)
    : [];

  const role = await rolesRepository.createRole({
    name: sanitizeUserHtml(name),
    description: sanitizeUserHtml(description ?? ''),
    permissions: permissionIds,
    isSystemRole: false,
    createdBy: actorId,
  });

  await recordActivity({
    action: ACTIVITY_ACTIONS.ROLE_CREATE,
    entityType: ENTITY_TYPES.ROLE,
    entityId: role.id,
    changes: { name, permissionCount: permissionIds.length },
  });

  return getRole(role.id);
};

export const updateRole = async (id, { name, description }, actorId) => {
  const role = await findRoleOrFail(id);

  if (name && name !== role.name) {
    if (role.isSystemRole) {
      throw new AppError('System roles cannot be renamed', 400, {
        code: ROLES_CODES.SYSTEM_ROLE_PROTECTED,
      });
    }
    await assertNameAvailable(name, id);
    role.name = sanitizeUserHtml(name);
  }
  if (description !== undefined) {
    role.description = sanitizeUserHtml(description);
  }
  role.updatedBy = actorId;

  const changedFields = role.modifiedPaths().filter((f) => f !== 'updatedBy');

  await withTransaction(async (session) => {
    await rolesRepository.saveRole(role, session);
    await recordActivity({
      action: ACTIVITY_ACTIONS.ROLE_UPDATE,
      entityType: ENTITY_TYPES.ROLE,
      entityId: role.id,
      changes: { fields: changedFields },
      session,
    });
  });

  return getRole(role.id);
};

export const deleteRole = async (id, actorId) => {
  const role = await findRoleOrFail(id);

  if (role.isSystemRole) {
    throw new AppError('System roles cannot be deleted', 400, {
      code: ROLES_CODES.SYSTEM_ROLE_PROTECTED,
    });
  }

  const assignedUsers = await usersRepository.countUsers({ role: role.id });
  if (assignedUsers > 0) {
    throw new AppError(
      `Cannot delete role: ${assignedUsers} user(s) are still assigned to it`,
      409,
      { code: ROLES_CODES.ROLE_IN_USE },
    );
  }

  await withTransaction(async (session) => {
    await role.softDelete(actorId, session ? { session } : {});
    await recordActivity({
      action: ACTIVITY_ACTIONS.ROLE_SOFT_DELETE,
      entityType: ENTITY_TYPES.ROLE,
      entityId: role.id,
      changes: { name: role.name },
      session,
    });
  });
};

/**
 * Replaces a role's permission set. Two documents change (the role and the
 * audit record), and a permission grant that isn't recorded — or a record of
 * a grant that didn't happen — is exactly the kind of drift an audit log is
 * supposed to rule out, so both go in one transaction.
 */
export const updateRolePermissions = async (id, permissionIds, actorId) => {
  const role = await findRoleOrFail(id);

  const previous = role.permissions.map(String);
  const next = await assertPermissionsExist(permissionIds);

  role.permissions = next;
  role.updatedBy = actorId;

  await withTransaction(async (session) => {
    await rolesRepository.saveRole(role, session);
    await recordActivity({
      action: ACTIVITY_ACTIONS.ROLE_PERMISSIONS_UPDATE,
      entityType: ENTITY_TYPES.ROLE,
      entityId: role.id,
      changes: {
        added: next.filter((p) => !previous.includes(p)),
        removed: previous.filter((p) => !next.includes(p)),
      },
      session,
    });
  });

  return getRole(role.id);
};

/** Touches every listed user document plus the audit record — one transaction. */
export const assignUsersToRole = async (id, userIds, actorId) => {
  const role = await findRoleOrFail(id);

  return withTransaction(async (session) => {
    const result = await usersRepository.assignRoleToUsers(
      userIds,
      role.id,
      actorId,
      session,
    );

    await recordActivity({
      action: ACTIVITY_ACTIONS.ROLE_USERS_ASSIGN,
      entityType: ENTITY_TYPES.ROLE,
      entityId: role.id,
      changes: { userIds: userIds.map(String), matched: result.matchedCount },
      session,
    });

    return { assignedCount: result.modifiedCount };
  });
};
