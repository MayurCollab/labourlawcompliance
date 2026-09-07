import * as rolesRepository from '../modules/roles/roles.repository.js';
import AppError from '../utils/AppError.js';
import asyncHandler from './asyncHandler.js';

/**
 * Dynamic RBAC guard. Must run AFTER authenticate (needs req.user).
 * Loads the user's role with its permissions from the database on every
 * request, so permission changes take effect immediately (no re-login).
 *
 * Usage (the reference pattern for every protected route):
 *   router.post('/', authenticate, checkPermission('users.create'), controller.create);
 *   router.delete('/:id', authenticate, checkPermission('users.delete'), controller.remove);
 *
 * Multiple arguments require ALL listed permissions.
 */
const checkPermission = (...requiredPermissions) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, {
        code: 'UNAUTHORIZED',
      });
    }

    const role = req.user.role
      ? await rolesRepository.findRoleByIdWithPermissions(req.user.role)
      : null;

    const granted = new Set((role?.permissions ?? []).map((p) => p.name));
    const missing = requiredPermissions.filter((p) => !granted.has(p));

    if (missing.length > 0) {
      throw new AppError(
        'You do not have permission to perform this action',
        403,
        { code: 'FORBIDDEN', errors: missing.map((p) => ({ message: `Missing permission: ${p}` })) },
      );
    }

    return next();
  });

export default checkPermission;
