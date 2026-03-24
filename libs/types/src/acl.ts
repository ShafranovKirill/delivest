import { Permission } from "../../../apps/delivest-api/generated/prisma/enums.js";

export interface CreateRoleRequest {
  name: string;
  permissions?: Permission[];
}
