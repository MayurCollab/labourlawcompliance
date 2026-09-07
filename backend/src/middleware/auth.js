import * as authRepository from '../modules/auth/auth.repository.js';
import AppError from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { setRequestContext } from '../utils/requestContext.js';
import asyncHandler from './asyncHandler.js';

/**
 * Authentication middleware.
 * Verifies the Bearer access token from the Authorization header, checks the
 * user still exists / is active / hasn't changed their password since the
 * token was issued, then attaches the user document to req.user.
 *
 * Usage:
 *   router.post('/change-password', authenticate, validate(...), controller);
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401, {
      code: 'UNAUTHORIZED',
    });
  }

  // jwt.verify throws JsonWebTokenError/TokenExpiredError — the global error
  // handler maps those to 401 INVALID_TOKEN / TOKEN_EXPIRED
  const payload = verifyAccessToken(header.slice('Bearer '.length));

  const user = await authRepository.findUserByIdWithAuthState(payload.sub);

  if (!user) {
    throw new AppError('The user for this token no longer exists', 401, {
      code: 'UNAUTHORIZED',
    });
  }

  if (!user.isActive) {
    throw new AppError('Your account has been disabled', 403, {
      code: 'ACCOUNT_DISABLED',
    });
  }

  if (
    user.passwordChangedAt &&
    payload.iat * 1000 < user.passwordChangedAt.getTime()
  ) {
    throw new AppError('Password was changed recently. Please log in again.', 401, {
      code: 'TOKEN_EXPIRED',
    });
  }

  req.user = user;
  // From here on every log line (and activity record) for this request
  // carries the acting user
  setRequestContext({ userId: String(user._id), userEmail: user.email });
  return next();
});

export default authenticate;
