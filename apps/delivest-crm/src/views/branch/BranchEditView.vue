<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useBranchStore } from "@/stores/branch.store";
import { useBranchForm } from "@/composables/useBranchForm";
import type { CreateBranchRequest, UpdateBranchRequest } from "@delivest/types";

const route = useRoute();
const router = useRouter();
const branchStore = useBranchStore();
const { submit, isSubmitting } = useBranchForm();

const branch = computed(() => branchStore.branches.find(b => b.alias === route.params.branchAlias));

const onSave = async (formData: CreateBranchRequest | UpdateBranchRequest) => {
  if (!branch.value?.id) return;

  const oldAlias = branch.value.alias;
  const newAlias = formData.alias;

  const { success } = await submit(branch.value.id, formData);

  if (success) {
    if (newAlias && oldAlias !== newAlias) {
      await branchStore.fetchBranches();
      branchStore.setActiveBranchByAlias(newAlias);

      await router.push({
        name: route.name || "branch-edit",
        params: { ...route.params, branchAlias: newAlias },
      });
    } else {
      router.push({ name: "branches-list" });
    }
  }
};
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-xl font-bold mb-6">{{ $t("branches.update.title") }}</h1>

    <div v-if="branch" class="bg-(--surface-card) p-6 rounded-2xl shadow-sm">
      <BranchForm :initialData="branch" :loading="isSubmitting" @submit="onSave" @cancel="router.back()" />
    </div>

    <div v-else class="text-center py-10">
      <i class="pi pi-spin pi-spinner text-3xl"></i>
    </div>
  </div>
</template>
