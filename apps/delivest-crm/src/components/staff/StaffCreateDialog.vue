<script setup lang="ts">
import Dialog from "primevue/dialog";
import StaffForm from "./StaffForm.vue";
import { useStaffForm } from "@/composables/useStaffForm";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "created"): void;
}>();

const { submit, isSubmitting } = useStaffForm();

const close = () => emit("update:visible", false);

const handleCreate = async (formData: {
  name: string;
  login: string;
  password?: string;
  roleId: string;
  branchIds: string[];
}) => {
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
    :header="t('staff.create.title')"
    :modal="true"
    :draggable="false"
    class="p-fluid w-full max-w-md">
    <StaffForm :loading="isSubmitting" :submit-label="t('common.create')" @submit="handleCreate" @cancel="close" />
  </Dialog>
</template>
