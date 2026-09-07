export type Permission = {
  id: string;
  name: string;
  module: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: Permission[] | string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRolePayload = {
  name: string;
  description?: string;
  permissions?: string[];
};

export type UpdateRolePayload = {
  name?: string;
  description?: string;
};

export type GroupedPermissions = Record<string, Permission[]>;
