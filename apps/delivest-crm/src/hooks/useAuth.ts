import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { useAuthStore } from "@/stores/auth.store";
import type { LoginStaffRequest, StaffResponse, TokenStaffResponse } from "@delivest/types";
import api from "@/api/axios";
import { computed } from "vue";

export function useAuth() {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["staff", "me"],
    queryFn: async () => {
      const { data } = await api.get<StaffResponse>("/staff/me");
      return data;
    },
    enabled: computed(() => !!authStore.accessToken),
    staleTime: 1000 * 20,
  });

  const loginMutation = useMutation({
    mutationFn: (dto: LoginStaffRequest) => api.post<TokenStaffResponse>("/staff/login", dto),
    onSuccess: async ({ data }) => {
      authStore.setToken(data.accessToken);
      await queryClient.invalidateQueries({ queryKey: ["staff", "me"] });
    },
  });

  return {
    profile: profileQuery,
    login: loginMutation,
    logout: () => authStore.logout(),
    isLoggedIn: computed(() => !!authStore.accessToken),
  };
}
