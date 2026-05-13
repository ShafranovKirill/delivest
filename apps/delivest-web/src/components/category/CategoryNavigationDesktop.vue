<script setup lang="ts">
import type { CategorizedProducts } from '@delivest/types'

defineProps<{ categorizedProducts: CategorizedProducts[] }>()
</script>
<template>
  <Card>
    <template #header>
      <div class="flex flex-row justify-start items-center px-2 py-2 h-15">
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Меню</h2>
      </div>
    </template>
    <template #content>
      <CategoryNavigationItem
        v-for="section in categorizedProducts"
        :key="section.id"
        :category="section"
      />
    </template>
  </Card>
</template>
