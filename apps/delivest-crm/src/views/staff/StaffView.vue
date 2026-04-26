<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useStaffStore } from "@/stores/staff.store";
import { useRoleStore } from "@/stores/role.store";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import type { StaffResponse } from "@delivest/types";
import { useI18n } from "vue-i18n";
import Button from "primevue/button";

const staffStore = useStaffStore();
const roleStore = useRoleStore();
const branchStore = useBranchStore();
const authStore = useAuthStore();
const { t } = useI18n();

const isCreateVisible = ref(false);
const isEditVisible = ref(false);
const isDeleteVisible = ref(false);
const selectedStaff = ref<StaffResponse | null>(null);

onMounted(async () => {
  if (staffStore.staffList.length === 0) {
    await staffStore.fetchAllStaff();
  }
  if (roleStore.roles.length === 0) {
    await roleStore.fetchAllRoles();
  }
  if (branchStore.branches.length === 0) {
    await branchStore.fetchBranches();
  }
});

const branchStaff = computed(() => {
  if (!branchStore.activeBranchId) return [];
  return staffStore.staffList.filter(staff => staff.branchIds && staff.branchIds.includes(branchStore.activeBranchId!));
});

const openEdit = (staff: StaffResponse) => {
  selectedStaff.value = staff;
  isEditVisible.value = true;
};

const openDelete = (staff: StaffResponse) => {
  selectedStaff.value = staff;
  isDeleteVisible.value = true;
};
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">
          {{ t("staff.branch.title") }} {{ branchStore.activeBranch?.name }}
        </h1>
        <p class="text-(--surface-500) text-sm">
          {{ t("staff.branch.subtitle") }}
        </p>
      </div>

      <Button
        v-if="authStore.hasPermission(Permission.STAFF_CREATE)"
        :label="t('staff.list.add_button')"
        icon="pi pi-plus"
        class="py-2 h-fit"
        @click="isCreateVisible = true" />
    </div>

    <div class="grid gap-4">
      <template v-if="staffStore.isLoading">
        <StaffCard v-for="i in 3" :key="i" loading />
      </template>

      <div
        v-else-if="branchStaff.length === 0"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-users text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">{{ t("staff.branch.empty") }}</p>
      </div>

      <template v-else>
        <StaffCard v-for="staff in branchStaff" :key="staff.id" :staff="staff" @select="openEdit">
          <template #actions>
            <Button
              v-if="authStore.hasPermission(Permission.STAFF_UPDATE)"
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              @click.stop="openEdit(staff)" />
            <Button
              v-if="authStore.hasPermission(Permission.STAFF_DELETE)"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click.stop="openDelete(staff)" />
          </template>
        </StaffCard>
      </template>
    </div>

    <StaffCreateDialog v-model:visible="isCreateVisible" />

    <StaffEditDialog v-model:visible="isEditVisible" :staff="selectedStaff" />

    <StaffDeleteDialog v-model:visible="isDeleteVisible" :staff="selectedStaff" @deleted="staffStore.fetchAllStaff()" />
  </div>
</template>
