<script setup lang="ts">
import Dialog from "primevue/dialog";
import { useBranchForm } from "@/composables/useBranchForm";
import { useRoute, useRouter } from "vue-router";
import { useBranchStore } from "@/stores/branch.store";
import type { BranchResponce } from "@delivest/types";

const props = defineProps<{
  visible: boolean;
  branch: BranchResponce | null;
}>();

const emit = defineEmits(["update:visible", "saved"]);

const router = useRouter();
const route = useRoute();
const branchStore = useBranchStore();
const { submit, isSubmitting } = useBranchForm();

const close = () => emit("update:visible", false);

const handleSave = async (formData: any) => {
  if (!props.branch) return;

  const oldAlias = props.branch.alias;
  const newAlias = formData.alias;

  const { success } = await submit(props.branch.id, formData);

  if (success) {
    const isEditingCurrentUrlBranch = route.params.branchAlias === oldAlias;

    if (isEditingCurrentUrlBranch && oldAlias !== newAlias) {
      await branchStore.fetchBranches();
      branchStore.setActiveBranchByAlias(newAlias);

      await router.push({
        name: route.name || "dashboard",
        params: { ...route.params, branchAlias: newAlias },
      });
    }

    emit("saved");
    close();
  }
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="close"
    :header="$t('branches.update.title')"
    :modal="true"
    :draggable="false"
    class="p-fluid w-full max-w-md">
    <BranchForm :initialData="branch" :loading="isSubmitting" @submit="handleSave" @cancel="close" />
  </Dialog>
</template>
