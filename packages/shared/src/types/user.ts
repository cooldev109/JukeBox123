// MVP: 3 roles. Stage 2 adds EMPLOYEE and AFFILIATE.
export enum UserRole {
  ADMIN = 'ADMIN',
  BAR_OWNER = 'BAR_OWNER',
  CUSTOMER = 'CUSTOMER',
  // Stage 2:
  // EMPLOYEE = 'EMPLOYEE',
  // AFFILIATE = 'AFFILIATE',
}

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateInput {
  email?: string;
  phone?: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface UserLoginInput {
  email?: string;
  phone?: string;
  password?: string;
  otp?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}
