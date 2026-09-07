import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authApi } from '@/api/auth.api';
import { PATHS } from '@/routes/paths';
import {
  loginWithCredentials,
  logoutSession,
  registerAccount,
} from '@/services/auth.service';
import { store } from '@/store';
import { setAccessToken } from '@/store/slices/authSlice';
import type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from '@/types/auth.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

/**
 * TanStack Query mutations for every auth flow.
 * Pages use these instead of calling the API / toasting directly.
 */
export const useLoginMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: ['auth', 'login'],
    mutationFn: ({
      email,
      password,
      rememberMe,
    }: LoginPayload & { rememberMe?: boolean }) =>
      loginWithCredentials(
        { email, password },
        { rememberMe: rememberMe ?? true },
      ),
    onSuccess: () => {
      toastSuccess('Logged in successfully');
      navigate(PATHS.home, { replace: true });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Login failed'));
    },
  });
};

export const useRegisterMutation = () =>
  useMutation({
    mutationKey: ['auth', 'register'],
    mutationFn: (payload: RegisterPayload) => registerAccount(payload),
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Registration failed'));
    },
  });

export const useVerifyEmailMutation = () =>
  useMutation({
    mutationKey: ['auth', 'verify-email'],
    mutationFn: (payload: VerifyEmailPayload) => authApi.verifyEmail(payload),
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Email verification failed'));
    },
  });

export const useForgotPasswordMutation = () =>
  useMutation({
    mutationKey: ['auth', 'forgot-password'],
    mutationFn: (payload: ForgotPasswordPayload) =>
      authApi.forgotPassword(payload),
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not send reset email'));
    },
  });

export const useResetPasswordMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: ['auth', 'reset-password'],
    mutationFn: (payload: ResetPasswordPayload) =>
      authApi.resetPassword(payload),
    onSuccess: (data) => {
      toastSuccess(data.message);
      navigate(PATHS.login, { replace: true });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Password reset failed'));
    },
  });
};

export const useChangePasswordMutation = () =>
  useMutation({
    mutationKey: ['auth', 'change-password'],
    mutationFn: (payload: ChangePasswordPayload) =>
      authApi.changePassword(payload),
    onSuccess: (data) => {
      store.dispatch(setAccessToken(data.data.accessToken));
      toastSuccess(data.message);
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not change password'));
    },
  });

export const useLogoutMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: () => logoutSession(),
    onSuccess: () => {
      toastSuccess('Logged out');
      navigate(PATHS.login, { replace: true });
    },
    onError: () => {
      // logoutSession already clears local state; still send the user to login
      navigate(PATHS.login, { replace: true });
    },
  });
};
