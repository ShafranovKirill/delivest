import { Permission } from "../../../apps/delivest-api/generated/prisma/enums";

export interface CreateRoleRequest {
  name: string;
  permissions?: Permission[];
}