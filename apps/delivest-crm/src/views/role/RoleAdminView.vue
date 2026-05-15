<script setup lang="ts">
import { onMounted, ref } from "vue";
import Button from "primevue/button";
import { useRoleStore } from "@/stores/role.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import type { RoleResponse } from "@delivest/types";
import { useI18n } from "vue-i18n";

const roleStore = useRoleStore();
const authStore = useAuthStore();
const { t } = useI18n();

const isCreateVisible = ref(false);
const isEditVisible = ref(false);
const isDeleteVisible = ref(false);
const selectedRole = ref<RoleResponse | null>(null);

onMounted(async () => {
  if (roleStore.roles.length === 0) {
    await roleStore.fetchAllRoles();
  }
});

const openEdit = (role: RoleResponse) => {
  selectedRole.value = role;
  isEditVisible.value = true;
};

const openDelete = (role: RoleResponse) => {
  selectedRole.value = role;
  isDeleteVisible.value = true;
};
</script>

<template>
  <teleport to="#app-header-slot">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">{{ t("roles.list.title") }}</h1>
        <p class="text-(--surface-500) text-sm">{{ t("roles.list.subtitle") }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="authStore.hasPermission(Permission.ROLE_CREATE)"
          :label="t('roles.list.add_button')"
          icon="pi pi-plus"
          class="py-2 h-fit"
          @click="isCreateVisible = true" />
      </div>
    </div>
  </teleport>

  <div class="p-6 max-w-4xl mx-auto">
    <div class="grid gap-4">
      <template v-if="roleStore.isLoading">
        <RoleCard v-for="i in 3" :key="i" loading />
      </template>

      <div
        v-else-if="roleStore.roles.length === 0"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-shield text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">{{ t("roles.list.empty") }}</p>
      </div>

      <template v-else>
        <RoleCard v-for="role in roleStore.availableRoles" :key="role.id" :role="role" @select="openEdit">
          <template #actions>
            <Button
              v-if="authStore.hasPermission(Permission.ROLE_UPDATE)"
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              @click.stop="openEdit(role)" />
            <Button
              v-if="authStore.hasPermission(Permission.ROLE_DELETE)"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click.stop="openDelete(role)" />
          </template>
        </RoleCard>
      </template>
    </div>

    <RoleCreateDialog v-model:visible="isCreateVisible" />

    <RoleEditDialog v-model:visible="isEditVisible" :role="selectedRole" />

    <RoleDeleteDialog v-model:visible="isDeleteVisible" :role="selectedRole" @deleted="roleStore.fetchAllRoles()" />
  </div>
</template>
