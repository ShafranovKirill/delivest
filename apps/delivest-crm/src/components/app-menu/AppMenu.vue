<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";

const router = useRouter();
const { t } = useI18n();
const branchStore = useBranchStore();
const authStore = useAuthStore();

const menuItems = computed(() => [
  {
    label: t("menu.orders"),
    icon: "pi pi-shopping-cart",
    visible: authStore.hasPermission(Permission.ORDER_READ),
    command: () => router.push({ name: "orders", params: { branchAlias: branchStore.activeBranchAlias } }),
  },
  {
    label: t("menu.organization"),
    icon: "pi pi-sitemap",
    visible: authStore.canAny([Permission.PRODUCT_READ, Permission.CATEGORY_READ, Permission.STAFF_READ]),
    items: [
      {
        label: t("menu.products"),
        icon: "pi pi-box",
        visible: authStore.hasPermission(Permission.PRODUCT_READ),
      },
      {
        label: t("menu.categories"),
        icon: "pi pi-tags",
        visible: authStore.hasPermission(Permission.CATEGORY_READ),
      },
      {
        label: t("menu.branch"),
        icon: "pi pi-building",
        visible: authStore.hasPermission(Permission.STAFF_READ),
        command: () => router.push({ name: "branch" }),
      },
      {
        label: t("menu.team"),
        icon: "pi pi-users",
        visible: authStore.hasPermission(Permission.STAFF_READ),
        items: [
          {
            label: t("menu.employees"),
            icon: "pi pi-user",
            visible: authStore.hasPermission(Permission.STAFF_READ),
            command: () => router.push({ name: "admin-branches" }),
          },
          {
            label: t("menu.role"),
            icon: "pi pi-tags",
            visible: authStore.hasPermission(Permission.ROLE_READ),
            command: () => router.push({ name: "branches" }),
          },
        ],
      },
    ].filter(item => item.visible !== false),
  },
]);

const adminMenuItems = computed(() => [
  {
    label: t("menu.admin_panel"),
    icon: "pi pi-shield",
    items: [
      {
        label: t("menu.all_staff"),
        icon: "pi pi-users",
        command: () => router.push({ name: "admin-staff" }),
      },
      {
        label: t("menu.system_logs"),
        icon: "pi pi-building",
        command: () => router.push({ name: "admin-branches" }),
      },
    ],
  },
]);
</script>

<template>
  <div class="flex flex-col h-full p-4 bg-surface-0 dark:bg-surface-900 transition-colors duration-300">
    <SidebarUserInfo :user="authStore.staff" />

    <div class="flex-1 overflow-y-auto">
      <PanelMenu :model="menuItems" class="w-full" />

      <div v-if="authStore.hasPermission(Permission.ADMIN)" class="mt-4">
        <div class="text-xs font-semibold text-surface-500 uppercase px-3 mb-2">
          {{ t("menu.administration") }}
        </div>
        <PanelMenu :model="adminMenuItems" class="w-full" />
      </div>
    </div>

    <SidebarSettings />
  </div>
</template>
