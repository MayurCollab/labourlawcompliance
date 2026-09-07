import type { AxiosError } from 'axios';

import type { ApiErrorResponse } from '@/types/api.types';

/** Pull a human-readable message out of an Axios / API error. */
export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong',
): string => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  return axiosError.response?.data?.message || fallback;
};
