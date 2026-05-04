<script setup lang="ts">
import { ref, watch } from "vue";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Button from "primevue/button";
import { useI18n } from "vue-i18n";
import type { ProductResponse, CreateProductRequest, CategoryResponse } from "@delivest/types";

type ProductFormData = Omit<CreateProductRequest, "branchId">;

const props = defineProps<{
  initialData?: ProductResponse | null;
  categories: CategoryResponse[];
  loading?: boolean;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  (event: "submit", payload: ProductFormData): void;
  (event: "cancel"): void;
}>();

const { t } = useI18n();

const form = ref<ProductFormData>({
  name: "",
  price: 0,
  categoryId: "",
  quantity: 1,
  weight: 0,
  description: "",
});

const resetForm = () => {
  form.value = {
    name: "",
    price: 0,
    categoryId: "",
    quantity: 1,
    weight: 0,
    description: "",
  };
};

watch(
  () => props.initialData,
  value => {
    if (value) {
      form.value = {
        name: value.name,
        price: value.price,
        categoryId: value.categoryId ?? "",
        quantity: value.quantity ?? 1,
        weight: value.weight ?? 0,
        description: value.description ?? "",
      };
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

const onSubmit = () => emit("submit", { ...form.value });
const onCancel = () => emit("cancel");
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="field">
      <label class="font-bold mb-1 block">{{ t("product.form.name") }}</label>
      <InputText v-model.trim="form.name" :placeholder="t('product.form.name_placeholder')" autofocus />
    </div>

    <div class="field">
      <label class="font-bold mb-1 block">{{ t("product.form.category") }}</label>
      <Select
        v-model="form.categoryId"
        :options="props.categories"
        optionLabel="name"
        optionValue="id"
        :placeholder="t('product.form.category_placeholder')"
        class="w-full" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="field">
        <label for="weight" class="font-bold mb-1 block">Вес (г)</label>
        <InputNumber id="weight" v-model="form.weight" :maxFractionDigits="0" suffix=" г" inputClass="w-full" />
      </div>
      <div class="field">
        <label for="quantity" class="font-bold mb-1 block">Кол-во</label>
        <InputNumber id="quantity" v-model="form.quantity" showButtons :min="1" inputClass="w-full" />
      </div>
    </div>

    <div class="field">
      <label for="price" class="font-bold mb-1 block">Цена</label>
      <InputNumber id="price" v-model="form.price" mode="currency" currency="RUB" locale="ru-RU" inputClass="w-full" />
    </div>

    <div class="field">
      <label class="font-bold mb-1 block">{{ t("product.form.description") }}</label>
      <Textarea v-model="form.description" rows="3" autoResize class="w-full" />
    </div>

    <div class="flex justify-end gap-2 mt-4">
      <Button :label="t('common.cancel')" icon="pi pi-times" text @click="onCancel" :disabled="props.loading" />
      <Button
        :label="props.submitLabel || t('common.save')"
        icon="pi pi-check"
        :loading="props.loading"
        :disabled="!form.name || !form.categoryId"
        @click="onSubmit" />
    </div>
  </div>
</template>
