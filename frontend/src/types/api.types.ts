/** Shared API response shapes matching the backend response formatter. */

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFieldError = {
  field?: string;
  location?: string;
  message: string;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: ApiFieldError[];
  code?: string;
};
