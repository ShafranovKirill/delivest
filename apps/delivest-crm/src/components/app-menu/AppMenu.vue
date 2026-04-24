<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";

const router = useRouter();
const { t } = useI18n();
const branchStore = useBranchStore();
const authStore = useAuthStore();

const menuItems = computed(() => [
  {
    label: t("menu.orders"),
    icon: "pi pi-shopping-cart",
    command: () => router.push({ name: "orders", params: { branchAlias: branchStore.activeBranchAlias } }),
  },
  {
    label: t("menu.branch"),
    icon: "pi pi-building",
    items: [
      { label: t("menu.products"), icon: "pi pi-box" },
      { label: t("menu.categories"), icon: "pi pi-tags" },
      { label: t("menu.employees"), icon: "pi pi-users" },
    ],
  },
]);
</script>

<template>
  <div class="flex flex-col h-full p-4 bg-surface-0 dark:bg-surface-900 transition-colors duration-300">
    <SidebarUserInfo :user="authStore.staff" />

    <div class="flex-1">
      <PanelMenu :model="menuItems" class="w-full" />
    </div>

    <SidebarSettings />
  </div>
</template>
