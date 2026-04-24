import { Permission } from "@common/constants.js";

export interface RefreshStaffTokenPayload {
  sub: string;
  login: string;
  iat?: number;
  exp?: number;
}

export interface AccessStaffTokenPayload extends RefreshStaffTokenPayload {
  roleId: string;
  permissions: Permission[];
  branchIds?: string[];
}

export interface CreateStaffRequest {
  branchIds: string[];
  login: string;
  password: string;
  roleId: string;
  name: string;
}

export interface UpdateStaffRequest {
  id: string;
  login: string;
  roleId: string;
  name: string;
  branchIds?: string[];
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
  branchIds: string[];
  login: string;
  roleId: string;
  name?: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangePasswordStaffRequest {
  id: string;
  oldPassword: string;
  newPassword: string;
}

export interface FindByLoginRequest {
  login: string;
}

export interface TokenStaffResponse {
  accessToken: string;
}
