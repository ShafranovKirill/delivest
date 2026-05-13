<script setup lang="ts">
import type { BranchResponce } from '@delivest/types'
import { computed } from 'vue'
import { useBranchStore } from '@/stores/branch.store'

const props = defineProps<{
  branch: BranchResponce
}>()

const emit = defineEmits(['select'])
const branchStore = useBranchStore()

const isActive = computed(() => branchStore.curentBranch?.alias === props.branch.alias)

const onSelect = () => {
  emit('select', props.branch.alias)
}
</script>

<template>
  <div
    @click="onSelect"
    :class="[
      'group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden',
      isActive
        ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--p-primary-rgb),0.1)]'
        : 'border-(--p-content-border-color) bg-(--p-content-background) hover:border-primary/40 hover:shadow-lg',
    ]"
  >
    <div
      :class="[
        'flex shrink-0 items-center justify-center w-12 h-12 rounded-xl transition-all duration-300',
        isActive
          ? 'bg-primary text-white scale-110'
          : 'bg-gray-100 dark:bg-white/5 group-hover:bg-primary/10 group-hover:text-primary',
      ]"
    >
      <i class="pi pi-map-marker text-xl" />
    </div>

    <div class="flex flex-col flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-bold text-lg leading-none truncate text-(--p-text-color)">
          {{ branch.name }}
        </h3>
        <i v-if="isActive" class="pi pi-check-circle text-primary shrink-0" />
      </div>

      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5">
        <span class="truncate">{{ branch.address || 'Адрес не указан' }}</span>
      </p>

      <div
        v-if="branch.phone || branch.description"
        class="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-4"
      >
        <div
          v-if="branch.phone"
          class="flex items-center gap-1.5 text-xs font-medium text-gray-400"
        >
          <i class="pi pi-phone text-[10px]" />
          {{ branch.phone }}
        </div>
        <div
          v-if="branch.description"
          class="flex items-center gap-1.5 text-xs text-gray-400 truncate"
        >
          <i class="pi pi-info-circle text-[10px]" />
          <span class="truncate italic">{{ branch.description }}</span>
        </div>
      </div>
    </div>

    <div
      class="absolute left-0 top-0 bottom-0 w-1 bg-primary transition-transform duration-300 origin-left"
      :class="isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'"
    />
  </div>
</template>
