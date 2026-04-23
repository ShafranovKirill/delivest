<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Card from "primevue/card";
import Button from "primevue/button";
import { useAuth } from "@/hooks/useAuth";

const { t } = useI18n();

const { profile, logout } = useAuth();
const handleLogout = () => {
  void logout();
};
</script>

<template>
  <div class="min-h-dvh bg-(--surface-ground) p-6 flex flex-col items-center">
    <div class="w-full max-w-2xl flex justify-between items-center mb-8">
      <h1 class="text-2xl font-bold text-(--text-color) m-0">
        {{ t("dashboard.title") }}
      </h1>
      <Button :label="t('auth.logout_button')" icon="pi pi-sign-out" severity="danger" text @click="handleLogout" />
    </div>

    <Card class="w-full max-w-2xl shadow-sm">
      <template #title>
        <div class="flex items-center gap-3">
          <i class="pi pi-user text-2xl text-blue-500" />
          <span>{{ t("dashboard.user_info") }}</span>
        </div>
      </template>

      <template #content>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            v-for="(value, key) in profile.data.value"
            :key="key"
            class="border border-(--surface-border) rounded-lg overflow-hidden flex flex-col">
            <span class="px-4 py-2 text-sm font-bold uppercase tracking-wider border-b">
              {{ key }}
            </span>

            <span class="p-1 text-lg font-medium text-(--text-color) break-all">
              {{ value || "—" }}
            </span>
          </div>
        </div>
      </template>

      <template #footer>
        <p class="text-xs m-0 italic">
          {{ t("dashboard.status_active") }}
        </p>
      </template>
    </Card>
  </div>
</template>
