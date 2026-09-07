export type RoleRef = {
  id: string;
  name: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: RoleRef | null;
  permissions: string[];
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthCredentials = {
  user: User;
  accessToken: string;
  permissions?: string[];
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type VerifyEmailPayload = {
  token: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};
