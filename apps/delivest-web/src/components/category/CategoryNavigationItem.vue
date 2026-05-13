<script setup lang="ts">
import type { CategoryResponse } from '@delivest/types'

defineProps<{
  category: CategoryResponse
}>()

const scrollToCategory = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div @click="scrollToCategory(category.id)" class="cursor-pointer p-4">
    <span class="font-semibold">
      {{ category.name }}
    </span>
  </div>
</template>
