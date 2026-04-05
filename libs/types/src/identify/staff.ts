import { Permission } from "../../../../apps/delivest-api/generated/prisma/enums.js";

export interface RefreshStaffTokenPayload {
  sub: string;
  login: string;
  iat?: number;
  exp?: number;
}

export interface AccessStaffTokenPayload extends RefreshStaffTokenPayload {
  roleId: string;
  permissions: Permission[];
}

export interface CreateStaffRequest {
  login: string;
  password: string;
  roleId: string;
  name: string;
}

export interface UpdateStaffRequest {
  login: string;
  roleId: string;
  name: string;
}

export interface GetStaffRequest {
  id: string;
}

export interface LoginStaffRequest {
  login: string;
  password: string;
}

export interface StaffResponse {
  id: string;
  login: string;
  roleId: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangePasswordStaffRequest {
  oldPassword: string;
  newPassword: string;
}

export interface FindByLoginRequest {
  login: string;
}

export interface TokenStaffResponse {
  accessToken: string;
}
