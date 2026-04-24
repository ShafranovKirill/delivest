<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useThemeStore } from "@/stores/state/theme.store";
import { useLangStore } from "@/stores/state/lang.store";
import { useI18n } from "vue-i18n";

const router = useRouter();
const authStore = useAuthStore();
const branchStore = useBranchStore();
const themeStore = useThemeStore();
const langStore = useLangStore();
const { t } = useI18n();

const handleChangeBranch = () => {
  branchStore.clearActiveBranch();
  router.push({ name: "select-branch" });
};

const handleFullLogout = async () => {
  await authStore.logout();
  router.push({ name: "login" });
};
</script>

<template>
  <div class="mt-auto border-t border-surface-200 dark:border-surface-700 pt-4 flex flex-col gap-2">
    <Button
      :label="langStore.currentLocale === 'ru' ? 'English' : 'Русский'"
      icon="pi pi-language"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="langStore.toggleLocale" />

    <Button
      :label="themeStore.isDark ? t('menu.lightTheme') : t('menu.darkTheme')"
      :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="themeStore.toggleTheme" />

    <Button
      :label="t('menu.changeBranch')"
      icon="pi pi-refresh"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="handleChangeBranch" />

    <Button
      label="Выйти"
      icon="pi pi-sign-out"
      severity="danger"
      variant="text"
      class="w-full justify-start mt-2 text-red-500! hover:bg-red-50! dark:hover:bg-red-900/20!"
      @click="handleFullLogout" />
  </div>
</template>
