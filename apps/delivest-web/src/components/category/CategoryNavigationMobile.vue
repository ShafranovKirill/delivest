<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { CategorizedProducts } from '@delivest/types'
import { useCategoryStore } from '@/stores/category.store'

defineProps<{ categorizedProducts: CategorizedProducts[] }>()
const categoryStore = useCategoryStore()

const scrollContainer = ref<HTMLElement | null>(null)

const scrollToCategory = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    const offset = 120
    const bodyRect = document.body.getBoundingClientRect().top
    const elementRect = element.getBoundingClientRect().top
    const offsetPosition = elementRect - bodyRect - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    })
  }
}

watch(
  () => categoryStore.activeCategoryId,
  async (newId) => {
    await nextTick()
    const activeEl = scrollContainer.value?.querySelector(`[data-id="${newId}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <nav class="sticky top-16 z-40 w-full bg-(--p-content-background)">
    <div
      ref="scrollContainer"
      class="flex flex-row overflow-x-auto no-scrollbar gap-2 p-2 whitespace-nowrap"
    >
      <button
        v-for="category in categorizedProducts"
        :key="category.id"
        :data-id="category.id"
        @click="scrollToCategory(category.id)"
        :class="[
          'px-4 py-2 rounded-xl transition-all duration-300 text-sm flex-shrink-0',
          categoryStore.activeCategoryId === category.id
            ? 'bg-(--p-primary-color) text-(--p-primary-contrast-color) font-bold'
            : '',
        ]"
      >
        {{ category.name }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
