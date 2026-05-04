<script setup lang="ts">
import Dialog from "primevue/dialog";
import FileUpload from "primevue/fileupload";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProductForm } from "@/composables/useProductForm";
import { useProductStore } from "@/stores/product.store";
import { useCategoryStore } from "@/stores/category.store";
import ProductForm from "./ProductForm.vue";
import type { ProductResponse, CreateProductRequest } from "@delivest/types";

const props = defineProps<{
  visible: boolean;
  branchId: string | null;
  product?: ProductResponse | null;
}>();
const emit = defineEmits<{
  (event: "update:visible", value: boolean): void;
  (event: "success"): void;
}>();

const { t } = useI18n();
const { submit, isSubmitting } = useProductForm();
const productStore = useProductStore();
const categoryStore = useCategoryStore();

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);

const isEditMode = computed(() => !!props.product);
const headerText = computed(() => (isEditMode.value ? t("product.update.title") : t("product.create.title")));
const submitLabel = computed(() => (isEditMode.value ? t("common.save") : t("common.create")));

watch(
  () => props.visible,
  async isOpen => {
    if (isOpen) {
      const branchId = props.branchId ?? props.product?.branchId;
      if (branchId) {
        await categoryStore.fetchByBranch(branchId);
      }
    } else {
      selectedFile.value = null;
      previewUrl.value = null;
    }
  },
  { immediate: true },
);

const onFileSelect = (event: any) => {
  const file = event.files[0];
  if (file) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }
};

const close = () => {
  emit("update:visible", false);
  selectedFile.value = null;
  previewUrl.value = null;
};

const handleSubmit = async (formData: Omit<CreateProductRequest, "branchId">) => {
  const branchId = props.branchId ?? props.product?.branchId;
  if (!branchId) return;

  const id = props.product?.id ?? null;

  const { success, data } = await submit(id, id ? { productId: id, ...formData, branchId } : { ...formData, branchId });
  if (!success) return;

  const finalProductId = data?.id ?? id;
  if (selectedFile.value && finalProductId) {
    try {
      await productStore.uploadProductImage(finalProductId, selectedFile.value);
    } catch (error) {
      console.error(t("product.list.image_load_error"), error);
    }
  }

  emit("success");
  close();
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="headerText"
    :modal="true"
    :draggable="false"
    class="p-fluid w-full max-w-lg">
    <div class="flex flex-col gap-4 mt-2">
      <div class="flex flex-col gap-2 border-2 border-dashed border-surface-200 p-4 rounded-lg items-center">
        <img v-if="previewUrl" :src="previewUrl" class="w-32 h-32 object-cover rounded shadow" />
        <div v-else class="w-32 h-32 bg-surface-100 flex items-center justify-center rounded">
          <i class="pi pi-image text-4xl text-surface-400"></i>
        </div>
        <FileUpload
          mode="basic"
          accept="image/*"
          @select="onFileSelect"
          auto
          :chooseLabel="t('product.form.image_upload')"
          class="p-button-sm w-full" />
      </div>

      <ProductForm
        :initialData="props.product"
        :categories="categoryStore.categories"
        :loading="isSubmitting"
        :submitLabel="submitLabel"
        @submit="handleSubmit"
        @cancel="close" />
    </div>
  </Dialog>
</template>
