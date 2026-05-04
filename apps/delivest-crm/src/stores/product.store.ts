import api from "@/api/axios";
import { socketState } from "@/plugins/socket";
import type { CreateProductRequest, ProductResponse, UpdateProductRequest } from "@delivest/types";
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
        const { data } = await api.get<ProductResponse[]>(`/admin/product/by-branch/${branchId}`);
        this.products = data;
      } catch (error) {
        console.error("Error fetching products for branch:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createProduct(payload: CreateProductRequest) {
      try {
        const { data } = await api.post<ProductResponse>(`/admin/product/create`, payload);
        this.products.push(data);
        return data;
      } catch (error) {
        console.error("Error creating product:", error);
        throw error;
      }
    },

    async updateProduct(payload: UpdateProductRequest) {
      try {
        const { data } = await api.patch<ProductResponse>(`/admin/product/update`, payload);
        const index = this.products.findIndex(product => product.id === payload.productId);
        if (index !== -1) {
          this.products[index] = data;
        }
        return data;
      } catch (error) {
        console.error("Error updating product:", error);
        throw error;
      }
    },

    async deleteProduct(id: string) {
      try {
        await api.delete(`/admin/product/delete/${id}`);
        this.products = this.products.filter(product => product.id !== id);
      } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
      }
    },

    async uploadProductImage(productId: string, file: File) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const sId = socketState.id;
        await api.post(`/admin/product/${productId}/photo?socketId=${sId}`, formData);
      } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
      }
    },
  },
});
