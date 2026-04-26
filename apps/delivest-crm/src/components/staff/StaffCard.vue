<script setup lang="ts">
import type { StaffResponse } from "@delivest/types";
import { useRoleStore } from "@/stores/role.store";

interface Props {
  staff?: StaffResponse;
  loading?: boolean;
  active?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "select", staff: StaffResponse): void;
}>();

const roleStore = useRoleStore();
</script>

<template>
  <div
    v-if="loading"
    class="h-16 bg-(--surface-card) border border-(--surface-border) rounded-xl p-4 flex items-center gap-4 animate-pulse">
    <div class="w-10 h-10 rounded-lg bg-(--surface-200) shrink-0"></div>
    <div class="flex-1">
      <div class="h-4 bg-(--surface-200) rounded w-1/3"></div>
    </div>
    <div class="w-12 h-8 bg-(--surface-200) rounded-lg"></div>
  </div>

  <div
    v-else-if="staff"
    @click="$emit('select', staff)"
    class="group relative p-4 rounded-xl flex items-center gap-4 transition-all duration-200 hover:shadow-md cursor-pointer bg-(--surface-card)"
    :class="[active ? 'border-2 border-primary' : 'border border-(--surface-border)']">
    <div
      class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      <i class="pi pi-user text-xl"></i>
    </div>

    <div class="flex flex-col flex-1 min-w-0">
      <h3 class="font-bold text-(--surface-900) truncate leading-tight">
        {{ staff.name || staff.login }}
      </h3>
      <p class="text-sm text-(--surface-500) truncate">
        {{ roleStore.getRoleNameById(staff.roleId) }} • {{ staff.branchIds.length }} филиалов
      </p>
    </div>

    <div v-if="$slots.actions" class="flex items-center gap-1 ml-auto" @click.stop>
      <slot name="actions" :staff="staff" />
    </div>
  </div>
</template>
