import type { AxiosError } from 'axios';

import type { ApiErrorResponse } from '@/types/api.types';

/** Pull a human-readable message out of an Axios / API error. */
export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong',
): string => {
  const axiosError = error as AxiosError<ApiErrorResponse> | null | undefined;
  return axiosError?.response?.data?.message || fallback;
};

/** Pull the machine-readable `code` (e.g. WHATSAPP_RECENTLY_SENT) out of an Axios / API error. */
export const getApiErrorCode = (error: unknown): string | null => {
  const axiosError = error as AxiosError<ApiErrorResponse> | null | undefined;
  return axiosError?.response?.data?.code || null;
};
