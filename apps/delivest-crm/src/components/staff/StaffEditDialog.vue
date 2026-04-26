<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Dialog from "primevue/dialog";
import StaffForm from "./StaffForm.vue";
import { useStaffForm } from "@/composables/useStaffForm";
import type { StaffResponse } from "@delivest/types";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  staff: StaffResponse | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "saved"): void;
}>();

const { submit, isSubmitting } = useStaffForm();

const isEditing = computed(() => !!props.staff);
const header = computed(() => (isEditing.value ? t("staff.edit.title") : t("staff.create.title")));
const submitLabel = computed(() => (isEditing.value ? t("common.save") : t("common.create")));

const close = () => emit("update:visible", false);

const handleSave = async (formData: {
  name: string;
  login: string;
  password?: string;
  roleId: string;
  branchIds: string[];
}) => {
  const data = { ...formData };
  if (isEditing.value) {
    delete data.password;
  }
  const { success } = await submit(props.staff?.id || null, data);

  if (success) {
    emit("saved");
    close();
  }
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="close"
    :header="header"
    :modal="true"
    :draggable="false"
    class="p-fluid w-full max-w-md">
    <StaffForm
      v-if="staff"
      :initial-data="staff"
      :loading="isSubmitting"
      :submit-label="submitLabel"
      @submit="handleSave"
      @cancel="close" />
  </Dialog>
</template>
