<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoleStore } from "@/stores/role.store";
import { useBranchStore } from "@/stores/branch.store";
import type { StaffResponse, CreateStaffRequest } from "@delivest/types";

const { t } = useI18n();
const roleStore = useRoleStore();
const branchStore = useBranchStore();

const props = defineProps<{
  initialData?: StaffResponse | CreateStaffRequest | null;
  loading?: boolean;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  (e: "submit", form: { name: string; login: string; password?: string; roleId: string; branchIds: string[] }): void;
  (e: "cancel"): void;
}>();

const form = ref({
  name: "",
  login: "",
  password: "",
  roleId: "",
  branchIds: [] as string[],
});

watch(
  () => props.initialData,
  val => {
    if (val) {
      Object.assign(form.value, {
        name: val.name || "",
        login: val.login || "",
        roleId: val.roleId || "",
        branchIds: val.branchIds ? [...val.branchIds] : [],
      });
    } else {
      form.value.name = "";
      form.value.login = "";
      form.value.password = "";
      form.value.roleId = "";
      form.value.branchIds = [];
    }
  },
  { immediate: true },
);

const roleOptions = computed(() => {
  return roleStore.availableRoles.map(role => ({
    label: role.name,
    value: role.id,
  }));
});

const branchOptions = computed(() => {
  return branchStore.branches.map(branch => ({
    label: branch.name,
    value: branch.id,
  }));
});

const onCancel = () => emit("cancel");
const onSubmit = () => emit("submit", { ...form.value });
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2 max-w-md">
      <label class="text-sm font-bold text-(--surface-900)">
        {{ t("staff.form.name") }}
      </label>
      <InputText v-model="form.name" :placeholder="t('staff.form.name_placeholder')" />
    </div>

    <div class="flex flex-col gap-2 max-w-md">
      <label class="text-sm font-bold text-(--surface-900)">
        {{ t("staff.form.login") }}
      </label>
      <InputText v-model="form.login" :placeholder="t('staff.form.login_placeholder')" />
    </div>

    <div v-if="!initialData" class="flex flex-col gap-2 max-w-md">
      <label class="text-sm font-bold text-(--surface-900)">
        {{ t("staff.form.password") }}
      </label>
      <Password v-model="form.password" :placeholder="t('staff.form.password_placeholder')" toggleMask />
    </div>

    <div class="flex flex-col gap-2 max-w-md">
      <label class="text-sm font-bold text-(--surface-900)">
        {{ t("staff.form.role") }}
      </label>
      <Dropdown
        v-model="form.roleId"
        :options="roleOptions"
        optionLabel="label"
        optionValue="value"
        :placeholder="t('staff.form.role_placeholder')"
        class="w-full" />
    </div>

    <div class="flex flex-col gap-2 max-w-md">
      <label class="text-sm font-bold text-(--surface-900)">
        {{ t("staff.form.branches") }}
      </label>
      <MultiSelect
        v-model="form.branchIds"
        :options="branchOptions"
        optionLabel="label"
        optionValue="value"
        :placeholder="t('staff.form.branches_placeholder')"
        :maxSelectedLabels="3"
        selectedItemsLabel="{0} филиалов выбрано"
        class="w-full" />
    </div>

    <div class="flex justify-end gap-2 mt-6 p-4 bg-(--surface-50) rounded-lg">
      <Button :label="t('common.cancel')" icon="pi pi-times" text @click="onCancel" />
      <Button
        :label="submitLabel || t('common.save')"
        icon="pi pi-check"
        :loading="loading"
        :disabled="
          !form.name || !form.login || (!initialData && !form.password) || !form.roleId || form.branchIds.length === 0
        "
        @click="onSubmit" />
    </div>
  </div>
</template>
