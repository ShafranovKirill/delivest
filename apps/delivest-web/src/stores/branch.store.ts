import { defineStore } from 'pinia'
import type { BranchResponce, GetStaffRequest } from '@delivest/types'

export const useBranchStore = defineStore('branch', {
  state: () => ({
    branches: [] as BranchResponce[],

    isLoading: true,
  }),
})
