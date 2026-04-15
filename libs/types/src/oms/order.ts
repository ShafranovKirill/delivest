import { DeliveryType } from "../../../../apps/delivest-api/generated/prisma/enums.js";

export interface BaseOrderRequest {
  cartId: string;
  phone: string;
  branchId: string;
  deliveryType: DeliveryType;
  comment?: string;
  address?: string;
  clientId?: string;
  staffId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ValidateOrderRequest extends BaseOrderRequest {}

export interface CreateOrderRequest extends BaseOrderRequest {
  validationToken: string;
}
