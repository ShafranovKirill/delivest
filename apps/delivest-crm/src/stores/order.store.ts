import api from "@/api/axios";
import { socket } from "@/plugins/socket";
import { SocketEvent } from "@delivest/types";
import type { OrderResponse, FindOrdersRequest, ValidateOrderResponse } from "@delivest/types";
import { defineStore } from "pinia";
import { useBranchStore } from "./branch.store";
import { useCartStore } from "./cart.store";

type OrderModalType = "TABLE" | "TAKEAWAY" | "DELIVERY" | "PICKUP";
type OrderStatusType = "PENDING" | "PROCESSING" | "READY" | "PICKED_UP" | "COMPLETED" | "CANCELLED";

const orderTypeLabels: Record<OrderModalType, string> = {
  TABLE: "За столом",
  TAKEAWAY: "На вынос",
  DELIVERY: "Доставка",
  PICKUP: "Самовывоз",
};

const orderTypeDeliveryMap: Record<OrderModalType, string> = {
  TABLE: "DINE_IN",
  TAKEAWAY: "PICKUP",
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
};

const deliveryTypeToOrderModalType: Record<string, OrderModalType> = {
  DINE_IN: "TABLE",
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
};

let socketListenersInitialized = false;

export const useOrderStore = defineStore("order", {
  state: () => ({
    orders: [] as OrderResponse[],
    isLoadingOrders: false,
    page: 1,
    limit: 20,
    orderStatus: undefined as FindOrdersRequest["orderStatus"],
    startDate: undefined as FindOrdersRequest["startDate"],
    endDate: undefined as FindOrdersRequest["endDate"],
    selectedOrder: null as OrderResponse | null,
    orderModalOpen: false,
    orderModalType: null as OrderModalType | null,
    orderRequest: {
      phone: "",
      address: "",
      comment: "",
      tableNumber: "",
    },
    validatedOrder: null as ValidateOrderResponse | null,
    isSubmittingOrder: false,
    isUpdatingOrder: false,
    successMessage: "",
    errorMessage: "",
  }),

  getters: {
    totalOrders: state => state.orders.length,
    activeOrderTypeLabel: state => (state.orderModalType ? orderTypeLabels[state.orderModalType] : ""),
    activeOrderDeliveryType: state => (state.orderModalType ? orderTypeDeliveryMap[state.orderModalType] : undefined),
    isEditingOrder: state => Boolean(state.selectedOrder),
  },

  actions: {
    async fetchOrdersForBranch(branchId: string, options: Partial<FindOrdersRequest> = {}) {
      this.isLoadingOrders = true;
      try {
        this.page = options.page ?? this.page;
        this.limit = options.limit ?? this.limit;
        this.orderStatus = options.orderStatus ?? this.orderStatus;
        this.startDate = options.startDate ?? this.startDate;
        this.endDate = options.endDate ?? this.endDate;

        const payload: FindOrdersRequest = {
          branchId,
          orderStatus: this.orderStatus,
          startDate: this.startDate,
          endDate: this.endDate,
          page: this.page,
          limit: this.limit,
        };

        const { data } = await api.request<OrderResponse[]>({
          method: "GET",
          url: "/admin/orders",
          data: payload,
        });

        this.orders = data;
      } catch (error) {
        console.error("Error fetching orders for branch:", error);
        throw error;
      } finally {
        this.isLoadingOrders = false;
      }
    },

    openOrderModal(type: OrderModalType) {
      this.orderModalType = type;
      this.orderModalOpen = true;
      this.selectedOrder = null;
      this.validatedOrder = null;
      this.orderRequest = {
        phone: "",
        address: "",
        comment: "",
        tableNumber: "",
      };
      this.successMessage = "";
      this.errorMessage = "";
    },

    openEditOrderModal(order: OrderResponse) {
      this.selectedOrder = order;
      this.orderModalType = deliveryTypeToOrderModalType[order.deliveryType] ?? "DELIVERY";
      this.orderModalOpen = true;
      this.validatedOrder = null;
      this.orderRequest = {
        phone: order.phone,
        address: order.address ?? "",
        comment: order.comment ?? "",
        tableNumber: "",
      };
      this.successMessage = "";
      this.errorMessage = "";
    },

    closeOrderModal() {
      this.orderModalOpen = false;
      this.orderModalType = null;
      this.selectedOrder = null;
      this.validatedOrder = null;
      this.successMessage = "";
      this.errorMessage = "";
    },

    async validateStaffOrder() {
      const cartStore = useCartStore();
      if (!cartStore.cart || !this.orderModalType) {
        throw new Error("Невозможно создать заказ без активной корзины или типа заказа");
      }

      const branchStore = useBranchStore();
      const branchId = branchStore.activeBranchId;
      if (!branchId) {
        throw new Error("Active branch is required");
      }

      if (!this.orderRequest.phone.trim()) {
        this.errorMessage = "Введите телефон клиента";
        return null;
      }

      this.isSubmittingOrder = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const payload: Record<string, unknown> = {
          cartId: cartStore.cart.id,
          branchId,
          status: "PENDING",
          phone: this.orderRequest.phone,
          deliveryType: orderTypeDeliveryMap[this.orderModalType],
          comment: this.orderRequest.comment || undefined,
          address: this.orderModalType === "DELIVERY" ? this.orderRequest.address || undefined : undefined,
        };

        if (this.orderModalType === "TABLE" && this.orderRequest.tableNumber) {
          payload.comment = `Стол ${this.orderRequest.tableNumber}${
            this.orderRequest.comment ? ` — ${this.orderRequest.comment}` : ""
          }`;
        }

        const { data } = await api.post<ValidateOrderResponse>("/admin/orders/validate", payload);
        this.validatedOrder = data;
        return data;
      } catch (error) {
        console.error("Error validating staff order:", error);
        this.errorMessage = "Не удалось проверить заказ. Проверьте данные и попробуйте снова.";
        return null;
      } finally {
        this.isSubmittingOrder = false;
      }
    },

    async createStaffOrder() {
      if (this.selectedOrder) {
        this.closeOrderModal();
        return;
      }

      if (!this.validatedOrder) {
        throw new Error("Заказ должен быть предварительно подтверждён");
      }

      const cartStore = useCartStore();
      const branchStore = useBranchStore();
      const branchId = branchStore.activeBranchId;
      if (!branchId) {
        throw new Error("Active branch is required");
      }

      this.isSubmittingOrder = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const { data: createdOrder } = await api.post<OrderResponse>("/admin/orders", {
          validationToken: this.validatedOrder.validationToken,
        });

        this.successMessage = `Заказ #${createdOrder.orderNumber} создан`;
        this.validatedOrder = null;
        await this.fetchOrdersForBranch(branchId);
        await cartStore.fetchStaffCart(branchId);
        this.closeOrderModal();
      } catch (error) {
        console.error("Error creating staff order:", error);
        this.errorMessage = "Не удалось создать заказ. Проверьте данные и попробуйте снова.";
      } finally {
        this.isSubmittingOrder = false;
      }
    },

    async updateOrderStatus(orderId: string, status: OrderStatusType) {
      this.isUpdatingOrder = true;
      try {
        const { data } = await api.patch<OrderResponse>("/admin/orders/status", {
          orderId,
          status,
        });

        const index = this.orders.findIndex(order => order.id === orderId);
        if (index !== -1) {
          this.orders[index] = data;
        }
        if (this.selectedOrder?.id === orderId) {
          this.selectedOrder = data;
        }
      } catch (error) {
        console.error("Error updating order status:", error);
        throw error;
      } finally {
        this.isUpdatingOrder = false;
      }
    },

    async addProductToOrder(orderId: string, productId: string, quantity: number = 1) {
      this.isUpdatingOrder = true;
      try {
        const { data } = await api.post<OrderResponse>("/admin/orders/item", {
          orderId,
          productId,
          quantity,
        });

        const index = this.orders.findIndex(order => order.id === orderId);
        if (index !== -1) {
          this.orders[index] = data;
        }
        if (this.selectedOrder?.id === orderId) {
          this.selectedOrder = data;
        }
      } catch (error) {
        console.error("Error adding product to order:", error);
        throw error;
      } finally {
        this.isUpdatingOrder = false;
      }
    },

    async removeProductFromOrder(orderId: string, productId: string, deleteAll = false) {
      this.isUpdatingOrder = true;
      try {
        const { data } = await api.patch<OrderResponse>("/admin/orders/item", {
          orderId,
          productId,
          deleteAll,
        });

        const index = this.orders.findIndex(order => order.id === orderId);
        if (index !== -1) {
          this.orders[index] = data;
        }
        if (this.selectedOrder?.id === orderId) {
          this.selectedOrder = data;
        }
      } catch (error) {
        console.error("Error removing product from order:", error);
        throw error;
      } finally {
        this.isUpdatingOrder = false;
      }
    },

    async refreshOrders() {
      const branchStore = useBranchStore();
      const activeBranchId = branchStore.activeBranchId;
      if (!activeBranchId) return;
      await this.fetchOrdersForBranch(activeBranchId, {
        page: this.page,
        limit: this.limit,
        orderStatus: this.orderStatus,
        startDate: this.startDate,
        endDate: this.endDate,
      });
    },

    initSocketListeners() {
      if (socketListenersInitialized) return;
      socketListenersInitialized = true;

      socket.on(SocketEvent.ORDER_CREATED, async (payload: { branchId: string; orderId: string }) => {
        const branchStore = useBranchStore();
        if (!branchStore.activeBranchId) return;
        if (payload.branchId !== branchStore.activeBranchId) return;

        await this.refreshOrders();
      });
    },
  },
});
