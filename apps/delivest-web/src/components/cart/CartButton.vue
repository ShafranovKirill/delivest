<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'

const cartStore = useCartStore()
</script>
<template>
  <Button
    icon="pi pi-shopping-bag
"
    class="shrink-0"
    :label="`${cartStore.totalPrice} ₽`"
  />
</template>
