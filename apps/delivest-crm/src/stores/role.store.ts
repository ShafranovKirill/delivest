import { defineStore } from "pinia";
import api from "@/api/axios";
import type { RoleResponse, CreateRoleRequest, UpdateRoleRequest } from "@delivest/types";

export const useRoleStore = defineStore("role", {
  state: () => ({
    roles: [] as RoleResponse[],
    currentRole: null as RoleResponse | null,
    isLoading: false,
  }),

  getters: {
    getRoleById: state => {
      return (id: string) => state.roles.find((r: RoleResponse) => r.id === id);
    },
    roleNames: state => state.roles.map((r: RoleResponse) => r.name),
  },

  actions: {
    async fetchAllRoles() {
      this.isLoading = true;
      try {
        const { data } = await api.get<RoleResponse[]>("/roles/all");
        this.roles = data;
      } catch (error) {
        console.error("Error fetching roles:", error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchOneRole(id: string) {
      this.isLoading = true;
      try {
        const { data } = await api.get<RoleResponse>(`/roles/${id}`);
        this.currentRole = data;
        return data;
      } catch (error) {
        console.error(`Error fetching role ${id}:`, error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createRole(payload: CreateRoleRequest) {
      try {
        const { data } = await api.post<RoleResponse>("/roles", payload);
        this.roles.push(data);
        return data;
      } catch (error) {
        console.error("Error creating role:", error);
        throw error;
      }
    },

    async updateRole(id: string, payload: UpdateRoleRequest) {
      try {
        const { data } = await api.patch<RoleResponse>(`/roles/${id}`, payload);

        const index = this.roles.findIndex((r: RoleResponse) => r.id === id);
        if (index !== -1) {
          this.roles[index] = data;
        }

        if (this.currentRole?.id === id) {
          this.currentRole = data;
        }

        return data;
      } catch (error) {
        console.error("Error updating role:", error);
        throw error;
      }
    },

    async deleteRole(id: string) {
      try {
        await api.delete(`/roles/${id}`);

        this.roles = this.roles.filter((r: RoleResponse) => r.id !== id);

        if (this.currentRole?.id === id) {
          this.currentRole = null;
        }
      } catch (error) {
        console.error("Error deleting role:", error);
        throw error;
      }
    },
  },
});
