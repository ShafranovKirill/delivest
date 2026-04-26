<script setup lang="ts">
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import type { StaffResponse } from "@delivest/types";
import { useI18n } from "vue-i18n";
import { useStaffForm } from "@/composables/useStaffForm";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  staff: StaffResponse | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "deleted"): void;
}>();

const { remove, isSubmitting } = useStaffForm();

const close = () => emit("update:visible", false);

const handleDelete = async () => {
  if (!props.staff) return;

  const { success } = await remove(props.staff);

  if (success) {
    emit("deleted");
    close();
  }
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="close"
    :header="t('staff.delete.title')"
    :modal="true"
    :draggable="false"
    class="w-full max-w-sm">
    <div class="flex flex-col items-center gap-4 py-4 text-center">
      <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <i class="pi pi-exclamation-triangle text-red-500 text-3xl"></i>
      </div>

      <p v-if="staff" class="text-(--surface-600)">
        {{ t("staff.delete.confirmation_text") }} <br />
        <span class="font-bold text-(--surface-900)">"{{ staff.name || staff.login }}"</span>?
      </p>
    </div>

    <template #footer>
      <div class="flex justify-center gap-3 w-full">
        <Button
          :label="t('common.cancel')"
          icon="pi pi-times"
          text
          severity="secondary"
          @click="close"
          :disabled="isSubmitting" />
        <Button
          :label="t('common.delete')"
          icon="pi pi-trash"
          severity="danger"
          :loading="isSubmitting"
          @click="handleDelete" />
      </div>
    </template>
  </Dialog>
</template>
