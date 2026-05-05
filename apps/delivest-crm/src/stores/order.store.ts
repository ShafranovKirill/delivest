import api from "@/api/axios";
import { socket } from "@/plugins/socket";
import { SocketEvent } from "@delivest/types";
import type { CartResponse, OrderResponse, FindOrdersRequest } from "@delivest/types";
import { defineStore } from "pinia";
import { useBranchStore } from "./branch.store";

type OrderModalType = "TABLE" | "TAKEAWAY" | "DELIVERY" | "PICKUP";

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

let socketListenersInitialized = false;

export const useOrderStore = defineStore("order", {
  state: () => ({
    orders: [] as OrderResponse[],
    isLoadingOrders: false,
    isLoadingCart: false,
    page: 1,
    limit: 20,
    orderStatus: undefined as FindOrdersRequest["orderStatus"],
    startDate: undefined as FindOrdersRequest["startDate"],
    endDate: undefined as FindOrdersRequest["endDate"],
    orderCart: null as CartResponse | null,
    orderModalOpen: false,
    orderModalType: null as OrderModalType | null,
    orderRequest: {
      phone: "",
      address: "",
      comment: "",
      tableNumber: "",
    },
    isSubmittingOrder: false,
    successMessage: "",
    errorMessage: "",
  }),

  getters: {
    totalOrders: state => state.orders.length,
    cartItemCount: state => state.orderCart?.totalItems ?? 0,
    activeOrderTypeLabel: state => (state.orderModalType ? orderTypeLabels[state.orderModalType] : ""),
    activeOrderDeliveryType: state => (state.orderModalType ? orderTypeDeliveryMap[state.orderModalType] : undefined),
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

    async fetchStaffCart(branchId: string) {
      this.isLoadingCart = true;
      try {
        const { data } = await api.get<CartResponse>(`/admin/cart/${branchId}`);
        this.orderCart = data;
      } catch (error) {
        console.error("Error fetching staff cart:", error);
        this.orderCart = null;
        throw error;
      } finally {
        this.isLoadingCart = false;
      }
    },

    async addProductToCart(productId: string, quantity: number = 1) {
      if (!this.orderCart) {
        throw new Error("Cart is not initialized");
      }

      this.isLoadingCart = true;
      try {
        const payload = {
          cartId: this.orderCart.id,
          productId,
          quantity,
        };

        const { data } = await api.post<CartResponse>("/admin/cart/add", payload);
        this.orderCart = data;
      } catch (error) {
        console.error("Error adding product to cart:", error);
        throw error;
      } finally {
        this.isLoadingCart = false;
      }
    },

    async removeProductFromCart(productId: string, deleteAll = false) {
      if (!this.orderCart) {
        throw new Error("Cart is not initialized");
      }

      this.isLoadingCart = true;
      try {
        const payload = {
          cartId: this.orderCart.id,
          productId,
          deleteAll,
        };

        const { data } = await api.patch<CartResponse>("/admin/cart/remove", payload);
        this.orderCart = data;
      } catch (error) {
        console.error("Error removing product from cart:", error);
        throw error;
      } finally {
        this.isLoadingCart = false;
      }
    },

    async clearStaffCart() {
      if (!this.orderCart) return;
      try {
        await api.delete(`/admin/cart/clear/${this.orderCart.id}`);
        this.orderCart = null;
      } catch (error) {
        console.error("Error clearing staff cart:", error);
        throw error;
      }
    },

    openOrderModal(type: OrderModalType) {
      this.orderModalType = type;
      this.orderModalOpen = true;
      this.orderRequest = {
        phone: "",
        address: "",
        comment: "",
        tableNumber: "",
      };
      this.successMessage = "";
      this.errorMessage = "";
    },

    closeOrderModal() {
      this.orderModalOpen = false;
      this.orderModalType = null;
      this.successMessage = "";
      this.errorMessage = "";
    },

    async createStaffOrder() {
      if (!this.orderCart || !this.orderModalType) {
        throw new Error("Невозможно создать заказ без активной корзины или типа заказа");
      }

      const branchStore = useBranchStore();
      const branchId = branchStore.activeBranchId;
      if (!branchId) {
        throw new Error("Active branch is required");
      }

      if (!this.orderRequest.phone.trim()) {
        this.errorMessage = "Введите телефон клиента";
        return;
      }

      this.isSubmittingOrder = true;
      this.errorMessage = "";
      this.successMessage = "";

      try {
        const payload = {
          cartId: this.orderCart.id,
          branchId,
          phone: this.orderRequest.phone,
          deliveryType: orderTypeDeliveryMap[this.orderModalType],
          comment: this.orderRequest.comment || undefined,
          address: this.orderModalType === "DELIVERY" ? this.orderRequest.address || undefined : undefined,
        } as Record<string, unknown>;

        if (this.orderModalType === "TABLE" && this.orderRequest.tableNumber) {
          payload.comment = `Стол ${this.orderRequest.tableNumber}${
            this.orderRequest.comment ? ` — ${this.orderRequest.comment}` : ""
          }`;
        }

        const { data: validationResult } = await api.post<{ validationToken: string }>(
          "/admin/orders/validate",
          payload,
        );

        const createPayload: Record<string, unknown> = {
          validationToken: validationResult.validationToken,
        };

        const { data: createdOrder } = await api.post<OrderResponse>("/admin/orders", createPayload);

        this.successMessage = `Заказ #${createdOrder.orderNumber} создан`;
        await this.fetchOrdersForBranch(branchId);
        await this.fetchStaffCart(branchId);
      } catch (error) {
        console.error("Error creating staff order:", error);
        this.errorMessage = "Не удалось создать заказ. Проверьте данные и попробуйте снова.";
      } finally {
        this.isSubmittingOrder = false;
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
