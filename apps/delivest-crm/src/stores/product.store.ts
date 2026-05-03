import api from "@/api/axios";
import { socketState } from "@/plugins/socket";
import type { CreateProductRequest, ProductResponse } from "@delivest/types";
import { defineStore } from "pinia";
export const useProductStore = defineStore("product", {
  state: () => ({
    products: [] as ProductResponse[],
    isLoading: false,
  }),

  getters: {},

  actions: {
    async fetchProductsForBranch(branchId: string) {
      this.isLoading = true;
      try {
        const { data } = await api.get<ProductResponse[]>(`/admin/product/by-category/${branchId}`);
        this.products = data;
      } catch (error) {
        console.error("Error fetching branches:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createProduct(payload: CreateProductRequest, file: File | null | undefined) {
      try {
        const formData = new FormData();

        Object.keys(payload).forEach(key => {
          const value = payload[key as keyof CreateProductRequest];

          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });

        if (file) {
          formData.append("file", file);
        }

        const sId = socketState.id;

        const { data } = await api.post<ProductResponse>(`/admin/product/create?socketId=${sId}`, formData);

        this.products.push(data);
        return data;
      } catch (error) {
        console.error("Error creating product:", error);
        throw error;
      }
    },
  },
});
