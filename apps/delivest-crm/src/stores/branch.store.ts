import type { BranchResponce } from "@delivest/types";
import { defineStore } from "pinia";
import api from "@/api/axios";

export const useBranchStore = defineStore("branch", {
  state: () => ({
    branches: [] as BranchResponce[],
    activeBranchId: localStorage.getItem("selectedBranchId") as string | null,
    isLoading: false,
  }),

  getters: {
    activeBranch: state => {
      return state.branches.find(b => b.id === state.activeBranchId) || null;
    },
    isBranchSelected: state => !!state.activeBranchId,
    activeBranchAlias: state => {
      const branch = state.branches.find(b => b.id === state.activeBranchId);
      return branch?.alias || "";
    },
  },

  actions: {
    async fetchBranches() {
      this.isLoading = true;
      try {
        const { data } = await api.get<BranchResponce[]>("/admin/branch/all");
        this.branches = data;

        if (this.branches.length === 1 && !this.activeBranchId) {
          this.setActiveBranch(this.branches[0].id);
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      } finally {
        this.isLoading = false;
      }
    },

    setActiveBranch(branchId: string) {
      this.activeBranchId = branchId;
      localStorage.setItem("selectedBranchId", branchId);
    },

    setActiveBranchByAlias(alias: string) {
      const branch = this.branches.find(b => b.alias === alias);
      if (branch) {
        this.setActiveBranch(branch.id);
        return true;
      }
      return false;
    },

    clearActiveBranch() {
      this.activeBranchId = null;
      localStorage.removeItem("selectedBranchId");
    },
  },
});
