import api from '@/api/axios'
import type { ProductResponse } from '@delivest/types'
import { defineStore } from 'pinia'

export const useProsuctStore = defineStore('product', {
  state: () => ({
    products: [] as ProductResponse[],
    isLoading: false,
  }),

  actions: {
    async fetchProsuctsForBranch(branchId: string) {
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
