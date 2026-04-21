import type { NavigationGuardNext, RouteLocationNormalized } from "vue-router";
import { useAuthStore } from "@/stores/auth.store";

export async function authMiddleware(
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) {
  const authStore = useAuthStore();

  if (!authStore.isInitialized) {
    await authStore.init();
  }

  const isLoggedIn = authStore.isLoggedIn;

  if (!isLoggedIn && to.name !== "login") {
    return next({ name: "login" });
  }

  if (isLoggedIn && to.name === "login") {
    return next({ name: "dashboard" });
  }

  next();
}
