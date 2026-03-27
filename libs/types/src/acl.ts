import { Permission } from "../../../apps/delivest-api/generated/prisma/enums.js";

export interface CreateRoleRequest {
  name: string;
  permissions?: Permission[];
}

export interface UpdateRoleRequest {
  name?: string;
  permissions?: Permission[];
}

export interface GetRoleRequest {
  id: string;
}

export interface RoleResponse {
  id: string;
  name: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}
