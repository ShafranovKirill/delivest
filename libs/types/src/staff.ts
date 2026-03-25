import { Permission } from "../../../apps/delivest-api/generated/prisma/enums.js";

export interface RefreshStaffTokenPayload {
  sub: string;
  login: string;
  iat?: number;
  exp?: number;
}

export interface AccessStaffTokenPayload extends RefreshStaffTokenPayload {
  role: string;
  permissions: Permission[];
}
