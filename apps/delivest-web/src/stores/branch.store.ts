import { defineStore } from 'pinia'
import type { BranchResponce, GetStaffRequest } from '@delivest/types'
import api from '@/api/axios'
import { useCategoryStore } from './category.store'
import { useProductStore } from './product.store'
import { useCartStore } from './cart.store'
import { watch } from 'vue'

export const useBranchStore = defineStore('branch', {
  state: () => ({
    branches: [] as BranchResponce[],
    curentBranch: null as BranchResponce | null,
    isSelectionModalOpen: false,
    isLoading: true,
  }),
  actions: {
    async fetchBranches() {
      this.isLoading = true
      try {
        const { data } = await api.get<BranchResponce[]>('/branch')
        this.branches = data
        if (data.length === 1) {
          this.curentBranch = data[0] || null
        }
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },

    initBranchWatcher() {
      const categoryStore = useCategoryStore()
      const productStore = useProductStore()
      const cartStore = useCartStore()

      watch(
        () => this.curentBranch?.id,
        async (newBranchId) => {
          if (newBranchId) {
            await Promise.all([
              categoryStore.fetchCategoriesForBranch(newBranchId),
              productStore.fetchProductsForBranch(newBranchId),
              productStore.fetchCategorizedProductsForBranch(newBranchId),
              cartStore.fetchCart(),
            ])
          } else {
            categoryStore.caterories = []
            productStore.products = []
          }
        },
        { immediate: true },
      )
    },

    async setBranchByAlias(branchAlias: string) {
      this.curentBranch = this.branches.find((b) => b.alias === branchAlias) || null
    },

    openSelectionModal() {
      this.isSelectionModalOpen = true
    },
    closwSelectionModal() {
      this.isSelectionModalOpen = false
    },
  },
})
