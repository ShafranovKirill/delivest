import { defineStore } from "pinia";

export const useMenuStore = defineStore("menu", {
  state: () => ({
    isSidebarVisible: true,
  }),
  actions: {
    toggleSidebar() {
      this.isSidebarVisible = !this.isSidebarVisible;
    },
    setSidebarVisible(value: boolean) {
      this.isSidebarVisible = value;
    },
  },
  persist: {
    key: "menu-storage",
    storage: localStorage,
  },
});
