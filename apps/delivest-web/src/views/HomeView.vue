<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useProsuctStore } from '@/stores/product.store'
import { computed, onMounted, watch } from 'vue'

const branchStore = useBranchStore()
const productStore = useProsuctStore()

const loadProducts = async () => {
  if (branchStore.curentBranch?.id) {
    await productStore.fetchProsuctsForBranch(branchStore.curentBranch!.id)
  }
}
onMounted(loadProducts)

watch(
  () => branchStore.curentBranch?.id,
  async (newId) => {
    if (newId) {
      await loadProducts()
    }
  },
)

const products = computed(() => productStore.products)
const isLoading = computed(() => productStore.isLoading)
</script>

<template>
  <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5 md:gap-6 pt-4 py-1">
    <template v-if="isLoading">
      <ProductCard v-for="i in 12" :key="i" :loading="true" />
    </template>

    <template v-else>
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
        :loading="false"
      />
    </template>
  </div>
</template>
