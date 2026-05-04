<script setup lang="ts">
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import { useProductForm } from "@/composables/useProductForm";
import type { ProductResponse } from "@delivest/types";

const props = defineProps<{
  visible: boolean;
  product: ProductResponse | null;
}>();

const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "deleted"): void;
}>();

const { remove, isSubmitting } = useProductForm();

const close = () => emit("update:visible", false);

const handleDelete = async () => {
  const { success } = await remove(props.product);
  if (success) {
    emit("deleted");
    close();
  }
};
</script>

<template>
  <Dialog
    :visible="props.visible"
    @update:visible="close"
    :header="$t('product.delete.title')"
    :modal="true"
    :draggable="false"
    class="w-full max-w-sm">
    <div class="flex flex-col items-center gap-4 py-4 text-center">
      <i class="pi pi-exclamation-triangle text-red-500 text-5xl"></i>
      <p v-if="props.product">
        {{ $t("product.delete.confirmation_text") }} <br />
        <span class="font-bold">"{{ props.product.name }}"</span>?
      </p>
    </div>

    <template #footer>
      <div class="flex justify-center gap-2 w-full">
        <Button :label="$t('common.cancel')" icon="pi pi-times" text @click="close" :disabled="isSubmitting" />
        <Button
          :label="$t('common.delete')"
          icon="pi pi-trash"
          severity="danger"
          :loading="isSubmitting"
          @click="handleDelete" />
      </div>
    </template>
  </Dialog>
</template>
