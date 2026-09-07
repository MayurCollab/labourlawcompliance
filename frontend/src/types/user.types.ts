import type { User } from '@/types/auth.types';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'email' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
};

export type ListUsersResult = {
  users: User[];
  pagination: PaginationMeta;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  role?: string | null;
  isActive?: boolean;
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string | null;
};
