import { defineStore } from "pinia";
import api from "@/api/axios";
import type {
  StaffResponse,
  CreateStaffRequest,
  UpdateStaffRequest,
  ChangePasswordStaffRequest,
} from "@delivest/types";

export const useStaffStore = defineStore("staff", {
  state: () => ({
    staffList: [] as StaffResponse[],
    currentStaff: null as StaffResponse | null,
    isLoading: false,
  }),

  getters: {
    totalStaff: state => state.staffList.length,

    getStaffById: state => {
      return (id: string) => state.staffList.find((s: StaffResponse) => s.id === id);
    },

    hasData: state => state.staffList.length > 0,
  },

  actions: {
    async fetchAllStaff() {
      this.isLoading = true;
      try {
        const { data } = await api.get<StaffResponse[]>("/admin/staff/all");
        this.staffList = data;
      } catch (error) {
        console.error("Error fetching all staff:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchOneStaff(id: string) {
      this.isLoading = true;
      try {
        const { data } = await api.get<StaffResponse>(`/admin/staff/${id}`);
        this.currentStaff = data;
        return data;
      } catch (error) {
        console.error(`Error fetching staff with id ${id}:`, error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createStaff(payload: CreateStaffRequest) {
      try {
        const { data } = await api.post<StaffResponse>("/admin/staff/create", payload);
        this.staffList.push(data);
        return data;
      } catch (error) {
        console.error("Error creating staff:", error);
        throw error;
      }
    },

    async updateStaff(payload: UpdateStaffRequest) {
      try {
        const { data } = await api.patch<StaffResponse>("/admin/staff/update", payload);

        const index = this.staffList.findIndex((s: StaffResponse) => s.id === payload.id);
        if (index !== -1) {
          this.staffList[index] = data;
        }

        if (this.currentStaff?.id === data.id) {
          this.currentStaff = data;
        }

        return data;
      } catch (error) {
        console.error("Error updating staff:", error);
        throw error;
      }
    },

    async deleteStaff(id: string) {
      try {
        await api.delete(`/admin/staff/delete/${id}`);
        this.staffList = this.staffList.filter((s: StaffResponse) => s.id !== id);
      } catch (error) {
        console.error("Error deleting staff:", error);
        throw error;
      }
    },

    async changePassword(payload: ChangePasswordStaffRequest) {
      try {
        await api.patch("/admin/staff/password", payload);
      } catch (error) {
        console.error("Error changing password:", error);
        throw error;
      }
    },

    async fetchMe() {
      try {
        const { data } = await api.get<StaffResponse>("/admin/staff/me");
        this.currentStaff = data;
        return data;
      } catch (error) {
        console.error("Error fetching current user:", error);
        throw error;
      }
    },
  },
});
