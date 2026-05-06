import api from "@/api/axios";
import { defineStore } from "pinia";
import type { AddToCartRequest, CartResponse, RemoveFromCartRequest } from "@delivest/types";

export const useCartStore = defineStore("cart", {
  state: () => ({
    cart: null as CartResponse | null,
    isLoadingCart: false,
    isUpdatingCart: false,
    errorMessage: "",
  }),

  getters: {
    totalItems: state => state.cart?.totalItems ?? 0,
    totalPrice: state => state.cart?.totalPrice ?? 0,
  },

  actions: {
    async fetchStaffCart(branchId: string) {
      this.isLoadingCart = true;
      this.errorMessage = "";

      try {
        const { data } = await api.get<CartResponse>(`/admin/cart/${branchId}`);
        this.cart = data;
        return data;
      } catch (error) {
        console.error("Error fetching staff cart:", error);
        this.errorMessage = "Не удалось загрузить корзину";
        throw error;
      } finally {
        this.isLoadingCart = false;
      }
    },

    async addProductToCart(productId: string, quantity = 1) {
      if (!this.cart) {
        throw new Error("Cart is not loaded");
      }

      this.isUpdatingCart = true;
      this.errorMessage = "";

      try {
        const payload: AddToCartRequest = {
          cartId: this.cart.id,
          productId,
          quantity,
        };
        const { data } = await api.post<CartResponse>("/admin/cart/add", payload);
        this.cart = data;
        return data;
      } catch (error) {
        console.error("Error adding product to cart:", error);
        this.errorMessage = "Не удалось добавить товар в корзину";
        throw error;
      } finally {
        this.isUpdatingCart = false;
      }
    },

    async removeProductFromCart(productId: string, deleteAll = false) {
      if (!this.cart) {
        throw new Error("Cart is not loaded");
      }

      this.isUpdatingCart = true;
      this.errorMessage = "";

      try {
        const payload: RemoveFromCartRequest = {
          cartId: this.cart.id,
          productId,
          deleteAll,
        };
        const { data } = await api.patch<CartResponse>("/admin/cart/remove", payload);
        this.cart = data;
        return data;
      } catch (error) {
        console.error("Error removing product from cart:", error);
        this.errorMessage = "Не удалось обновить корзину";
        throw error;
      } finally {
        this.isUpdatingCart = false;
      }
    },

    async clearStaffCart() {
      if (!this.cart) {
        return;
      }

      this.isUpdatingCart = true;
      this.errorMessage = "";

      try {
        await api.delete(`/admin/cart/clear/${this.cart.id}`);
        this.cart = null;
      } catch (error) {
        console.error("Error clearing staff cart:", error);
        this.errorMessage = "Не удалось очистить корзину";
        throw error;
      } finally {
        this.isUpdatingCart = false;
      }
    },
  },
});
