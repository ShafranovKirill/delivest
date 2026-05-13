<script setup lang="ts">
import type { CategorizedProducts } from '@delivest/types'
import ProductCard from './ProductCard.vue'

defineProps<{
  section: CategorizedProducts
}>()
</script>

<template>
  <section :id="section.id" class="mb-8 last:mb-0">
    <div class="flex items-center justify-center mb-4 px-2">
      <h2 class="text-xl md:text-2xl font-bold">
        {{ section.name }}
      </h2>
    </div>

    <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 scroll-mt-21 2xl:grid-cols-4 md:gap-6">
      <ProductCard
        v-for="product in section.products"
        :key="product.id"
        :product="product"
        :loading="false"
      />
    </div>
  </section>
</template>
