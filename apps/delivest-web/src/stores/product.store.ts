import api from '@/api/axios'
import type { CategorizedProducts, ProductResponse } from '@delivest/types'
import { defineStore } from 'pinia'

export const useProductStore = defineStore('product', {
  state: () => ({
    categorizedProducts: [] as CategorizedProducts[],
    products: [] as ProductResponse[],
    isLoading: false,
  }),

  actions: {
    async fetchCategorizedProductsForBranch(branchId: string) {
      this.isLoading = true
      try {
        const { data } = await api.get<CategorizedProducts[]>(`/product/categorized/${branchId}`)
        this.categorizedProducts = data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
    async fetchProductsForBranch(branchId: string) {
      this.isLoading = true
      try {
        const { data } = await api.get<ProductResponse[]>(`/product/branch/${branchId}`)
        this.products = data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
  },
})
