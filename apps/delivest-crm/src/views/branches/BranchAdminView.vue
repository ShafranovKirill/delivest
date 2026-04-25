<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import type { BranchResponce } from "@delivest/types";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import { useI18n } from "vue-i18n";
import { useConfirm } from "primevue";
import { useRoute, useRouter } from "vue-router";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const { t } = useI18n();
const confirm = useConfirm();
const router = useRouter();
const route = useRoute();

onMounted(async () => {
  if (branchStore.branches.length === 0) {
    await branchStore.fetchBranches();
  }
});

const isEditDialogVisible = ref(false);
const isCreateVisible = ref(false);
const isDeleteVisible = ref(false);
const selectedBranch = ref<BranchResponce | null>(null);

const openEdit = (branch: BranchResponce) => {
  selectedBranch.value = branch;
  isEditDialogVisible.value = true;
};

const openDelete = (branch: BranchResponce) => {
  selectedBranch.value = branch;
  isDeleteVisible.value = true;
};

const handleBranchSwitch = (branch: BranchResponce) => {
  if (branchStore.activeBranchId === branch.id) return;

  confirm.require({
    message: `${t("branches.list.switch_confirm_msg")} "${branch.name}"?`,
    header: t("branches.list.switch_confirm_title"),
    icon: "pi pi-exclamation-triangle",
    rejectProps: {
      label: t("common.cancel"),
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: t("common.confirm"),
    },
    accept: () => {
      router.push({
        name: route.name || "dashboard",
        params: { branchAlias: branch.alias },
      });
    },
  });
};
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <ConfirmDialog />
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">{{ t("branches.list.title") }}</h1>
        <p class="text-(--surface-500) text-sm">{{ t("branches.list.subtitle") }}</p>
      </div>
      <Button
        v-if="authStore.hasPermission(Permission.BRANCH_CREATE)"
        :label="t('branches.list.add_button')"
        icon="pi pi-plus"
        class="py-2 h-fit"
        @click="isCreateVisible = true" />
    </div>

    <div class="grid gap-4">
      <template v-if="branchStore.isLoading">
        <BranchCard v-for="i in 3" :key="i" loading />
      </template>

      <div
        v-else-if="branchStore.branches.length === 0"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-map-marker text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">{{ t("branches.list.empty") }}</p>
      </div>

      <template v-else>
        <BranchCard
          v-for="branch in branchStore.branches"
          :key="branch.id"
          :branch="branch"
          :active="branchStore.activeBranchId === branch.id"
          @click="handleBranchSwitch(branch)">
          <template #actions>
            <Button
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              @click.stop="openEdit(branch)"
              v-if="authStore.hasPermission(Permission.BRANCH_UPDATE)" />
            <Button
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              @click.stop="openDelete(branch)"
              v-if="authStore.hasPermission(Permission.BRANCH_DELETE)" />
          </template>
        </BranchCard>
      </template>
    </div>

    <BranchCreateDialog v-model:visible="isCreateVisible" />
    <BranchEditDialog v-model:visible="isEditDialogVisible" :branch="selectedBranch" />
    <BranchDeleteDialog v-model:visible="isDeleteVisible" :branch="selectedBranch" />
  </div>
</template>
