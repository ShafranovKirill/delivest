<script setup lang="ts">
import Dialog from "primevue/dialog";
import BranchForm from "./BranchForm.vue";
import { useBranchForm } from "@/composables/useBranchForm";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(["update:visible", "created"]);

const { submit, isSubmitting } = useBranchForm();

const close = () => emit("update:visible", false);

const handleCreate = async (formData: any) => {
  const { success } = await submit(null, formData);

  if (success) {
    emit("created");
    close();
  }
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="close"
    :header="$t('branches.create.title')"
    :modal="true"
    :draggable="false"
    class="p-fluid w-full max-w-md">
    <BranchForm :loading="isSubmitting" :submitLabel="$t('common.create')" @submit="handleCreate" @cancel="close" />
  </Dialog>
</template>
