import axiosInstance from '@/api/axiosInstance';
import type { ApiSuccessResponse } from '@/types/api.types';
import type {
  AuthCredentials,
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  User,
  VerifyEmailPayload,
} from '@/types/auth.types';
import { setCsrfToken } from '@/utils/csrf';
import { getCsrfHeaders } from '@/utils/csrfHeaders';

type LoginResponse = { user: User; accessToken: string; csrfToken?: string };
type RegisterResponse = { user: User };
type MeResponse = { user: User };
type ChangePasswordResponse = { accessToken: string; csrfToken?: string };

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthCredentials> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<LoginResponse>
    >('/api/v1/auth/login', payload);

    setCsrfToken(data.data.csrfToken);

    return {
      user: data.data.user,
      accessToken: data.data.accessToken,
      permissions: data.data.user.permissions ?? [],
    };
  },

  register: async (payload: RegisterPayload) => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<RegisterResponse>
    >('/api/v1/auth/register', payload);
    return data;
  },

  verifyEmail: async (payload: VerifyEmailPayload) => {
    const { data } = await axiosInstance.post<ApiSuccessResponse<null>>(
      '/api/v1/auth/verify-email',
      payload,
    );
    return data;
  },

  forgotPassword: async (payload: ForgotPasswordPayload) => {
    const { data } = await axiosInstance.post<ApiSuccessResponse<null>>(
      '/api/v1/auth/forgot-password',
      payload,
    );
    return data;
  },

  resetPassword: async (payload: ResetPasswordPayload) => {
    const { data } = await axiosInstance.post<ApiSuccessResponse<null>>(
      '/api/v1/auth/reset-password',
      payload,
    );
    return data;
  },

  changePassword: async (payload: ChangePasswordPayload) => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<ChangePasswordResponse>
    >('/api/v1/auth/change-password', payload);
    setCsrfToken(data.data.csrfToken);
    return data;
  },

  logout: async () => {
    await axiosInstance.post('/api/v1/auth/logout', undefined, {
      headers: getCsrfHeaders(),
    });
  },

  logoutAll: async () => {
    await axiosInstance.post('/api/v1/auth/logout-all');
  },

  listSessions: async () => {
    const { data } = await axiosInstance.get<
      ApiSuccessResponse<{
        sessions: Array<{
          id: string;
          familyId: string;
          userAgent: string | null;
          ip: string | null;
          createdAt: string;
          expiresAt: string;
        }>;
      }>
    >('/api/v1/auth/sessions');
    return data.data.sessions;
  },

  revokeSession: async (id: string) => {
    await axiosInstance.delete(`/api/v1/auth/sessions/${id}`);
  },

  getMe: async (): Promise<User> => {
    const { data } = await axiosInstance.get<ApiSuccessResponse<MeResponse>>(
      '/api/v1/users/me',
    );
    return data.data.user;
  },

  refreshToken: async (): Promise<string> => {
    const { data } = await axiosInstance.post<
      ApiSuccessResponse<{ accessToken: string; csrfToken?: string }>
    >('/api/v1/auth/refresh-token', undefined, {
      headers: getCsrfHeaders(),
    });
    setCsrfToken(data.data.csrfToken);
    return data.data.accessToken;
  },
};
