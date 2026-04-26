import { createRouter, createWebHistory } from "vue-router";
import { authMiddleware } from "./middleware/auth.middleware";
import { branchMiddleware } from "./middleware/brench.middleware";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/auth/LoginView.vue"),
      meta: { guestOnly: true },
    },

    {
      path: "/:branchAlias",
      component: () => import("../layouts/DashboardLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("../views/dashboard/DashboardView.vue"),
        },
        {
          path: "orders",
          name: "orders",

          component: () => import("../views/orders/OrdersView.vue"),
        },
        {
          path: "branch",
          name: "branch",

          component: () => import("../views/branch/BranchEditView.vue"),
        },
        {
          path: "admin-branches",
          name: "admin-branches",

          component: () => import("../views/branch/BranchAdminView.vue"),
        },
        {
          path: "role",
          name: "role",

          component: () => import("../views/role/RoleAdminView.vue"),
        },
        {
          path: "staff",
          name: "staff",

          component: () => import("../views/staff/StaffView.vue"),
        },
        {
          path: "admin-staff",
          name: "admin-staff",

          component: () => import("../views/staff/StaffAdminView.vue"),
        },
      ],
    },
    {
      path: "/select-branch",
      name: "select-branch",
      component: () => import("../views/branch/BranchSelectView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/views/errors/NotFoundView.vue"),
    },
    {
      path: "/",
      name: "root",
      component: () => import("../views/auth/LoginView.vue"),
    },
  ],
});

router.beforeEach(async (to, from) => {
  const middlewares = [authMiddleware, branchMiddleware];

  for (const middleware of middlewares) {
    const result = await middleware(to, from);

    if (result !== true) {
      return result;
    }
  }
});
export default router;
