<script setup lang="ts">
import { ref } from "vue";
import { useProductStore } from "@/stores/product.store";

const props = defineProps<{
  visible: boolean;
  branchId: string | null;
}>();
const emit = defineEmits(["update:visible", "success"]);

const productStore = useProductStore();

const name = ref("");
const price = ref(0);
const description = ref("");
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const loading = ref(false);

const onFileSelect = (event: any) => {
  const file = event.files[0];
  if (file) {
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }
};

const close = () => {
  emit("update:visible", false);
  name.value = "";
  price.value = 0;
  description.value = "";
  selectedFile.value = null;
  previewUrl.value = null;
};

const save = async () => {
  loading.value = true;
  try {
    const payload = {
      name: name.value,
      price: price.value,
      description: description.value,
      branchId: "ID_ВАШЕГО_ФИЛИАЛА",
    };

    await productStore.createProduct(payload, selectedFile.value);

    emit("success");
    close();
  } catch (error) {
    console.error("Ошибка при создании:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    header="Создать новый товар"
    :modal="true"
    class="p-fluid w-full max-w-lg">
    <div class="flex flex-col gap-4 mt-2">
      <div class="flex flex-col items-center gap-2 border-2 border-dashed border-surface-200 p-4 rounded-lg">
        <img v-if="previewUrl" :src="previewUrl" class="w-32 h-32 object-cover rounded shadow" />
        <div v-else class="w-32 h-32 bg-surface-100 flex items-center justify-center rounded">
          <i class="pi pi-image text-4xl text-surface-400"></i>
        </div>
        <FileUpload
          mode="basic"
          accept="image/*"
          @select="onFileSelect"
          auto
          chooseLabel="Выбрать фото"
          class="p-button-sm" />
      </div>

      <div class="field">
        <label for="name" class="font-bold mb-1 block">Название</label>
        <InputText id="name" v-model.trim="name" required autofocus />
      </div>

      <div class="field">
        <label for="price" class="font-bold mb-1 block">Цена</label>
        <InputNumber id="price" v-model="price" mode="currency" currency="RUB" locale="ru-RU" />
      </div>

      <div class="field">
        <label for="description" class="font-bold mb-1 block">Описание</label>
        <Textarea id="description" v-model="description" rows="3" autoResize />
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" text @click="close" />
      <Button label="Создать" icon="pi pi-check" :loading="loading" @click="save" :disabled="!name" />
    </template>
  </Dialog>
</template>
