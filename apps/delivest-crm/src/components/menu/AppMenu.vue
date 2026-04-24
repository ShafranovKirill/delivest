<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useBranchStore } from "@/stores/branch.store";
import { useThemeStore } from "@/stores/state/theme.store";
import { useI18n } from "vue-i18n";
import { useLangStore } from "@/stores/state/lang.store";

const router = useRouter();
const { t } = useI18n();
const branchStore = useBranchStore();
const themeStore = useThemeStore();
const langStore = useLangStore();

const menuItems = computed(() => [
  {
    label: t("menu.orders"),
    icon: "pi pi-shopping-cart",
    command: () =>
      router.push({
        name: "orders",
        params: { branchAlias: branchStore.activeBranchAlias },
      }),
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

const handleLogoutAndChange = () => {
  branchStore.clearActiveBranch();
  router.push({ name: "select-branch" });
};
</script>

<template>
  <div class="flex flex-col h-full p-4 bg-surface-0 dark:bg-surface-900 transition-colors duration-300">
    <div class="flex-1">
      <PanelMenu :model="menuItems" class="w-full" />
    </div>

    <div class="mt-auto border-t border-surface-200 dark:border-surface-700 pt-4 flex flex-col gap-2">
      <Button
        :label="langStore.currentLocale === 'ru' ? 'English' : 'Русский'"
        icon="pi pi-language"
        severity="secondary"
        text
        class="w-full justify-start"
        @click="langStore.toggleLocale" />

      <Button
        :label="themeStore.isDark ? t('menu.lightTheme') : t('menu.darkTheme')"
        :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
        severity="secondary"
        text
        class="w-full justify-start"
        @click="themeStore.toggleTheme" />

      <Button
        :label="t('menu.changeBranch')"
        icon="pi pi-refresh"
        severity="secondary"
        text
        class="w-full justify-start"
        @click="handleLogoutAndChange" />
    </div>
  </div>
</template>
