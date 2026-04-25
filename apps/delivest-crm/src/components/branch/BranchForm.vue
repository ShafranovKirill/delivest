<script setup lang="ts">
import { ref, watch } from "vue";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import InputMask from "primevue/inputmask";
import Button from "primevue/button";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const props = defineProps<{
  initialData?: any;
  loading?: boolean;
  submitLabel?: string;
}>();

const emit = defineEmits(["submit", "cancel"]);

const form = ref({
  name: "",
  alias: "",
  address: "",
  description: "",
  phone: "",
});

watch(
  () => props.initialData,
  val => {
    if (val) form.value = { ...val };
  },
  { immediate: true },
);

const onCancel = () => emit("cancel");
const onSubmit = () => emit("submit", { ...form.value });
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-bold">{{ t("branches.form.name") }}</label>
      <InputText v-model="form.name" :placeholder="t('branches.form.name_placeholder')" autofocus />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-bold">{{ t("branches.form.alias") }}</label>
      <InputText v-model="form.alias" :placeholder="t('branches.form.alias_placeholder')" />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-bold">{{ t("branches.form.address") }}</label>
      <Textarea v-model="form.address" rows="2" autoResize :placeholder="t('branches.form.address_placeholder')" />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-bold">{{ t("branches.form.description") }}</label>
      <Textarea
        v-model="form.description"
        rows="3"
        autoResize
        :placeholder="t('branches.form.description_placeholder')" />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-bold">{{ t("branches.form.phone") }}</label>
      <InputMask v-model="form.phone" mask="+79999999999" placeholder="+79001234567" :unmask="false" />
    </div>

    <div class="flex justify-end gap-2 mt-4">
      <Button :label="t('common.cancel')" icon="pi pi-times" text @click="onCancel" />
      <Button
        :label="submitLabel || t('common.save')"
        :icon="loading ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
        :loading="loading"
        :disabled="!form.name || !form.alias"
        @click="onSubmit" />
    </div>
  </div>
</template>
