import { defineStore } from "pinia";
import router from "@/router";
import type { TokenStaffResponse } from "@delivest/types";
import axios from "axios";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: "" as string,
    isInitialized: false,
    refreshPromise: null as Promise<string | null> | null,
  }),

  getters: {
    isLoggedIn: state => !!state.accessToken,
  },

  actions: {
    setToken(token: string) {
      this.accessToken = token;
    },

    setInitialized(status: boolean) {
      this.isInitialized = status;
    },

    logout() {
      this.accessToken = "";
      router.push({ name: "login" });
    },

    async refresh(): Promise<string | null> {
      if (this.refreshPromise) return this.refreshPromise;

      this.refreshPromise = (async () => {
        try {
          const { data } = await axios.get<TokenStaffResponse>(`${import.meta.env.VITE_API_URL}/staff/refresh`, {
            withCredentials: true,
          });

          const token = data.accessToken;
          this.setToken(token);
          return token;
        } catch (e) {
          this.logout();
          return null;
        } finally {
          this.refreshPromise = null;
        }
      })();

      return this.refreshPromise;
    },
  },
  persist: {
    key: "auth-storage",
    storage: localStorage,
    pick: ["accessToken"],
  },
});
