import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { ApiErrorResponse, ApiSuccessResponse } from '@/types/api.types';
import { reportApiReachable } from '@/lib/networkStatus';
import {
  clearCredentials,
  setAccessToken,
} from '@/store/slices/authSlice';
import { store } from '@/store';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { setCsrfToken } from '@/utils/csrf';
import { getCsrfHeaders } from '@/utils/csrfHeaders';

const API_BASE_URL = getApiBaseUrl();

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Bare client for the refresh call — no interceptors, avoids loops. */
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiSuccessResponse<{ accessToken: string; csrfToken?: string }>>(
        '/api/v1/auth/refresh-token',
        undefined,
        { headers: getCsrfHeaders() },
      )
      .then((response) => {
        const token = response.data.data.accessToken;
        setCsrfToken(response.data.data.csrfToken);
        store.dispatch(setAccessToken(token));
        return token;
      })
      .catch((error: unknown) => {
        store.dispatch(clearCredentials());
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    reportApiReachable(true);
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as RetryConfig | undefined;

    // No response object at all = the request never reached the API.
    // A 4xx/5xx means the API answered, so it is reachable.
    reportApiReachable(
      Boolean(error.response) && error.code !== 'ECONNABORTED',
    );

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry
    ) {
      return Promise.reject(error);
    }

    // Don't try to refresh the refresh call itself
    if (originalRequest.url?.includes('/auth/refresh-token')) {
      store.dispatch(clearCredentials());
      return Promise.reject(error);
    }

    // Login/register 401s are credential errors — not session expiry
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default axiosInstance;
