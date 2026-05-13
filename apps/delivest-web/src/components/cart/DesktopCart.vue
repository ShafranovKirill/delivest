<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'

const cartStore = useCartStore()
</script>
<template>
  <Card>
    <template #header>
      <div class="flex flex-row justify-between items-center px-2 py-2">
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Корзина</h2>
        <Button label="Очистить" @click="cartStore.clearCart" text></Button>
      </div>
    </template>
    <template #content>
      <CartStep />
    </template>
  </Card>
</template>
