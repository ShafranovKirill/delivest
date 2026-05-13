<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'

const branchStore = useBranchStore()
defineEmits(['openModal'])
</script>

<template>
  <div
    @click="$emit('openModal')"
    class="group flex text-(--p-primary-contrast-color) items-center bg-(--p-primary-color) gap-1 cursor-pointer px-3 py-2 rounded-xl transition-all"
  >
    <i class="pi pi-map-marker"></i>
    <div class="flex flex-col items-start text-left">
      <div class="flex items-center gap-1">
        <span class="text-sm font-bold leading-none truncate max-w-30 sm:max-w-50">
          {{ branchStore.curentBranch?.name || 'Выбрать филиал' }}
        </span>
        <i
          class="pi pi-chevron-down text-[10px]! transition-transform group-hover:translate-y-0.5"
        />
      </div>
    </div>
  </div>
</template>
