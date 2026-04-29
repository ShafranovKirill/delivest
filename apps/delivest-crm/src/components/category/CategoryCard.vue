<script setup lang="ts">
import type { CategoryResponse } from "@delivest/types";

interface Props {
  category?: CategoryResponse;
  loading?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "select", categoryId: string): void;
}>();
</script>

<template>
  <div
    v-if="loading"
    class="h-20 bg-(--surface-card) border border-(--surface-border) rounded-xl p-4 flex items-center gap-4 animate-pulse">
    <div class="w-10 h-10 rounded-lg bg-(--surface-200) shrink-0"></div>
    <div class="flex-1">
      <div class="h-4 bg-(--surface-200) rounded w-1/3 mb-2"></div>
      <div class="h-3 bg-(--surface-100) rounded w-1/4"></div>
    </div>
  </div>

  <div
    v-else-if="category"
    class="group relative p-4 rounded-xl flex items-center gap-4 transition-all duration-200 hover:shadow-md bg-(--surface-card) border border-(--surface-border)">
    <div class="drag-handle cursor-grab active:cursor-grabbing p-2 text-(--surface-400) hover:text-primary">
      <i class="pi pi-bars"></i>
    </div>

    <div class="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
      <i class="pi pi-tags text-xl"></i>
    </div>

    <div class="flex-1 min-w-0">
      <h3 class="font-bold text-(--surface-900) truncate leading-tight">{{ category.name }}</h3>
      <p class="text-sm text-(--surface-500) truncate mt-1">Порядок: {{ category.order }}</p>
    </div>

    <div class="flex items-center gap-2 ml-auto" @click.stop>
      <slot name="actions" :category="category" />
    </div>
  </div>
</template>
