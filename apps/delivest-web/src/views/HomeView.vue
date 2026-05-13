<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useProsuctStore } from '@/stores/product.store'
import { watch } from 'vue'

const branchStore = useBranchStore()
const productStore = useProsuctStore()

const loadProducts = async () => {
  if (branchStore.curentBranch?.id) {
    await productStore.fetchProsuctsForBranch(branchStore.curentBranch!.id)
  }
}

watch(
  () => branchStore.curentBranch?.id,
  async (newId) => {
    if (newId) {
      await loadProducts()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-5 pt-4 py-1">
    <div class="grow">
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4 md:gap-6 pt-4 py-1">
        <template v-if="productStore.isLoading">
          <ProductCard v-for="i in 12" :key="i" :loading="true" />
        </template>

        <template v-else>
          <ProductCard
            v-for="product in productStore.products"
            :key="product.id"
            :product="product"
            :loading="false"
          />
        </template>
      </div>
    </div>
    <aside class="hidden lg:block w-full lg:w-87.5 shrink-0">
      <div class="sticky top-4"><DesktopCart /></div>
    </aside>
  </div>
</template>
