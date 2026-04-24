import { defineStore } from "pinia";
import api from "@/api/axios";
import type { BranchResponce, CreateBranchRequest, UpdateBranchRequest } from "@delivest/types"; // Проверь путь к типам

export const useBranchStore = defineStore("branch", {
  state: () => ({
    branches: [] as BranchResponce[],
    currentBranch: null as BranchResponce | null,
    activeBranchId: localStorage.getItem("selectedBranchId") as string | null,
    isLoading: false,
  }),

  getters: {
    activeBranch: state => {
      return state.branches.find((b: BranchResponce) => b.id === state.activeBranchId) || null;
    },
    isBranchSelected: state => !!state.activeBranchId,
    activeBranchAlias: state => {
      const branch = state.branches.find((b: BranchResponce) => b.id === state.activeBranchId);
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
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchOneBranch(id: string) {
      this.isLoading = true;
      try {
        const { data } = await api.get<BranchResponce>(`/admin/branch/${id}`);
        this.currentBranch = data;
        return data;
      } catch (error) {
        console.error(`Error fetching branch ${id}:`, error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createBranch(payload: CreateBranchRequest) {
      try {
        const { data } = await api.post<BranchResponce>("/admin/branch/create", payload);
        this.branches.push(data);
        return data;
      } catch (error) {
        console.error("Error creating branch:", error);
        throw error;
      }
    },

    async updateBranch(id: string, payload: UpdateBranchRequest) {
      try {
        const { data } = await api.patch<BranchResponce>(`/admin/branch/update/${id}`, payload);

        const index = this.branches.findIndex((b: BranchResponce) => b.id === id);
        if (index !== -1) {
          this.branches[index] = data;
        }

        if (this.currentBranch?.id === id) {
          this.currentBranch = data;
        }

        return data;
      } catch (error) {
        console.error("Error updating branch:", error);
        throw error;
      }
    },

    async deleteBranch(id: string) {
      try {
        await api.delete(`/admin/branch/delete/${id}`);

        this.branches = this.branches.filter((b: BranchResponce) => b.id !== id);

        if (this.activeBranchId === id) {
          this.clearActiveBranch();
        }
      } catch (error) {
        console.error("Error deleting branch:", error);
        throw error;
      }
    },

    setActiveBranch(branchId: string) {
      this.activeBranchId = branchId;
      localStorage.setItem("selectedBranchId", branchId);
    },

    setActiveBranchByAlias(alias: string) {
      const branch = this.branches.find((b: BranchResponce) => b.alias === alias);
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
