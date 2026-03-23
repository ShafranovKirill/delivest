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