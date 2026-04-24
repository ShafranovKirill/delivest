<script setup lang="ts">
import { onMounted } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth.store";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const router = useRouter();
const { t } = useI18n();

onMounted(async () => {
  if (branchStore.branches.length === 0) {
    await branchStore.fetchBranches();
  }
});

const selectBranch = (id: string) => {
  branchStore.setActiveBranch(id);
  router.push({
    name: "dashboard",
    params: { branchAlias: branchStore.activeBranchAlias },
  });
};
</script>

<template>
  <div class="min-h-dvh bg-(--surface-ground) p-6 flex flex-col items-center justify-center">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-(--surface-900) mb-2">
        {{ t("branches.select_title") }}
      </h1>
      <p class="text-(--surface-500)">
        {{ t("branches.select_subtitle") }}
      </p>
    </div>

    <div class="w-full max-w-2xl">
      <div
        v-if="branchStore.isLoading && branchStore.branches.length === 0"
        class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="h-27.5 bg-(--surface-card) border border-(--surface-border) rounded-xl p-6 flex items-center gap-5 animate-pulse">
          <div class="w-14 h-14 rounded-xl bg-(--surface-200) shrink-0"></div>
          <div class="flex-1">
            <div class="h-5 bg-(--surface-200) rounded w-3/4 mb-2"></div>
            <div class="h-4 bg-(--surface-100) rounded w-1/2"></div>
          </div>
        </div>
      </div>

      <div v-else-if="branchStore.branches.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="branch in branchStore.branches"
          :key="branch.id"
          @click="selectBranch(branch.id)"
          class="group relative bg-(--surface-card) border border-(--surface-border) p-6 rounded-xl cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg active:scale-95 flex items-center min-h-27.5">
          <span class="absolute top-3 right-4 text-[10px] font-bold uppercase tracking-wider text-(--surface-400)">
            {{ branch.alias }}
          </span>

          <div class="flex items-center gap-5 w-full pr-10">
            <div
              class="shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-all duration-300 shadow-sm">
              <i class="pi pi-building text-2xl"></i>
            </div>

            <div class="flex flex-col justify-center">
              <h3
                class="text-lg font-bold text-(--surface-900) group-hover:text-primary transition-colors leading-tight">
                {{ branch.name }}
              </h3>
              <p v-if="branch.address" class="text-sm text-(--surface-500) mt-1 line-clamp-1">
                {{ branch.address }}
              </p>
            </div>
          </div>

          <div
            class="absolute bottom-3 right-4 flex items-center text-[11px] font-bold uppercase tracking-widest text-primary opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <span>{{ t("common.select") }}</span>
            <i class="pi pi-arrow-right ml-2"></i>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center p-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-xl">
        <i class="pi pi-exclamation-circle text-4xl text-(--surface-400) mb-4"></i>
        <p class="text-(--surface-600)">{{ t("branches.no_branches_found") || "Нет доступных филиалов" }}</p>
      </div>
    </div>

    <Button
      variant="text"
      severity="secondary"
      class="mt-8"
      icon="pi pi-sign-out"
      label="Выйти из аккаунта"
      @click="authStore.logout()" />
  </div>
</template>
