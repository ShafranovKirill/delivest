<script setup lang="ts">
import CategoryNavigationDesktop from '@/components/category/CategoryNavigationDesktop.vue'
import { useProductStore } from '@/stores/product.store'

const productStore = useProductStore()
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-5 pt-4 py-1">
    <aside class="hidden lg:block w-64 shrink-0">
      <div class="sticky top-21 flex flex-col gap-2">
        <CategoryNavigationDesktop :categorized-products="productStore.categorizedProducts" />
      </div>
    </aside>

    <div class="grow">
      <div
        v-if="productStore.isLoading"
        class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      >
        <ProductCard v-for="i in 12" :key="i" :loading="true" />
      </div>

      <template v-else>
        <ProductSection
          v-for="section in productStore.categorizedProducts"
          :id="section.id"
          :key="section.id"
          :section="section"
        />

        <div v-if="productStore.categorizedProducts.length === 0" class="text-center py-20">
          <p class="text-gray-500">В этом филиале пока нет доступных товаров</p>
        </div>
      </template>
    </div>

    <aside class="hidden lg:block w-full lg:w-87.5 shrink-0">
      <div class="sticky top-21">
        <DesktopCart />
      </div>
    </aside>
  </div>
</template>
