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

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isGuestOnly = to.matched.some(record => record.meta.guestOnly);

  if (requiresAuth && !isLoggedIn) {
    return next({ name: "login" });
  }

  if (isGuestOnly && isLoggedIn) {
    return next({ name: "dashboard" });
  }

  next();
}
