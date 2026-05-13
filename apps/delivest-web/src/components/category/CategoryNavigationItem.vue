<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryResponse } from '@delivest/types'
import { useCategoryStore } from '@/stores/category.store'

const props = defineProps<{
  category: CategoryResponse
}>()

const categoryStore = useCategoryStore()

const isActive = computed(() => categoryStore.activeCategoryId === props.category.id)

const scrollToCategory = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    const offset = 80
    const bodyRect = document.body.getBoundingClientRect().top
    const elementRect = element.getBoundingClientRect().top
    const elementPosition = elementRect - bodyRect
    const offsetPosition = elementPosition - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    })
  }
}
</script>

<template>
  <div
    @click="scrollToCategory(category.id)"
    :class="[
      'cursor-pointer p-4 transition-all duration-300 rounded-2xl',
      isActive ? ' bg-(--p-primary-color)  text-(--p-primary-contrast-color)' : 'bg-transparent',
    ]"
  >
    <span :class="['transition-colors', isActive ? 'font-bold' : 'font-medium']">
      {{ category.name }}
    </span>
  </div>
</template>
