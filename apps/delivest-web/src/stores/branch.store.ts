import { defineStore } from 'pinia'
import type { BranchResponce, GetStaffRequest } from '@delivest/types'
import api from '@/api/axios'

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
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
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
