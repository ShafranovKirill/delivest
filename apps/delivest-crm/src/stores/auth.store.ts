import { defineStore } from "pinia";
import api from "../api/axios";
import type { LoginStaffRequest, StaffResponse, TokenStaffResponse } from "@delivest/types";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as StaffResponse | null,
    accessToken: "" as string,
    isInitialized: false,
  }),

  getters: {
    isLoggedIn: state => !!state.accessToken,
  },

  actions: {
    async login(dto: LoginStaffRequest) {
      const { data } = await api.post<TokenStaffResponse>("/staff/login", dto);
      this.accessToken = data.accessToken;
      await this.fetchMe();
    },

    async fetchMe() {
      try {
        const { data } = await api.get<StaffResponse>("/staff/me");
        this.user = data;
      } catch (e) {
        this.logout();
      }
    },

    async refresh() {
      const { data } = await api.get<TokenStaffResponse>("/staff/refresh");
      this.accessToken = data.accessToken;
    },

    logout() {
      this.accessToken = "";
      this.user = null;
      window.location.href = "/login";
    },

    async init() {
      try {
        await this.refresh();
        await this.fetchMe();
      } catch {
      } finally {
        this.isInitialized = true;
      }
    },
  },
});
