import { Permissions, type BranchResponce } from "@delivest/types";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth.store";

export const useBranchStore = defineStore("branch", {
  state: () => ({
    branches: [] as BranchResponce[],
    activeBranchId: null as string | null,
  }),
  getters: {
    avaliableBranches: state => {
      const authStore = useAuthStore();
      const staff = authStore.staff;
      if (!staff) return [];
      if (staff.permissions.includes(Permissions.ADMIN)) return state.branches;
    },
  },
  actions: {},
});
