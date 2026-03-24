import { Permission } from "../../../apps/delivest-api/generated/prisma/enums";

export interface RefreshTokenPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenPayload extends RefreshTokenPayload {
  role: string;
  permissions: Permission[];
}

export interface CreateAccountRequest {
  login: string;
  password: string;
  roleId?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}