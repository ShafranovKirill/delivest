import type { CategoryResponse } from '@delivest/types'
import { defineStore } from 'pinia'
import { useBranchStore } from './branch.store'
import api from '@/api/axios'
import { watch } from 'vue'
import { useProductStore } from './product.store'

export const useCategoryStore = defineStore('category', {
  state: () => ({
    caterories: [] as CategoryResponse[],
    activeCategoryId: null as string | null,
    isLoading: false,
  }),
  getters: {
    activeCategories: (state) => {
      const productStore = useProductStore()

      if (!productStore.products.length) return []

      const usedCategoryIds = new Set(productStore.products.map((p) => p.categoryId))
      return state.caterories.filter((category) => usedCategoryIds.has(category.id))
    },
  },
  actions: {
    async fetchCategoriesForBranch(branchId: string) {
      this.isLoading = true
      try {
        const { data } = await api.get<CategoryResponse[]>(`/category/filial/${branchId}`)
        this.caterories = data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
  },
})
