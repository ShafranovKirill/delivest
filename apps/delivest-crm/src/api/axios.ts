import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth.store";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.request.use(async config => {
  let token: string | undefined;

  try {
    const persisted = localStorage.getItem("auth-storage");
    if (persisted) {
      const parsed = JSON.parse(persisted);
      token = parsed?.accessToken;
    }
  } catch (e) {
    // ignore parse errors
  }

  // fallback to dynamic import of the auth store if needed
  if (!token) {
    try {
      const mod = await import("@/stores/auth.store");
      const authStore = mod.useAuthStore();
      token = authStore.accessToken;
    } catch (e) {
      // ignore dynamic import errors
    }
  }

  if (token) {
    if (!config.headers) config.headers = {} as any;
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // dynamic import auth store to avoid circular dependency at module load
    let authStore: any = null;
    try {
      const mod = await import("@/stores/auth.store");
      authStore = mod.useAuthStore();
    } catch (e) {
      // if we cannot access the store, reject
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes("/staff/refresh")) {
      authStore.logout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await authStore.refresh();

      if (newToken) {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        return api(originalRequest);
      }
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }

    return Promise.reject(error);
  },
);

export default api;
