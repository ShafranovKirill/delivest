export enum SocketEvent {
  PHOTO_EDIT_RESULT = "photo_edit_result",
  ORDER_CREATED = "order_created",
}

export interface OrderCreatedPayload {
  branchId: string;
  orderId: string;
}
