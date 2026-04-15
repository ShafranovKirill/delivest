import { DeliveryType } from "../../../../apps/delivest-api/generated/prisma/enums.js";

export interface CreateOrderRequest {
  cartId: string;
  phone: string;
  branchId: string;
  deliveryType?: DeliveryType;
  comment?: string;
  address?: string;
  clientId?: string;
  staffId?: string;
  validationToken?: string;
}
