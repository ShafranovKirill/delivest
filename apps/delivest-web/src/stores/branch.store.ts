import { defineStore } from 'pinia'
import type { BranchResponce, GetStaffRequest } from '@delivest/types'
import api from '@/api/axios'

export const useBranchStore = defineStore('branch', {
  state: () => ({
    branches: [] as BranchResponce[],
    curentBranch: null as BranchResponce | null,
    isLoading: true,
  }),
  actions: {
    async fetchBranches() {
      this.isLoading = true
      try {
        const { data } = await api.get('/branch')
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
  },
})
