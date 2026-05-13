<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
const cartStore = useCartStore()
</script>
<template>
  <Button
    icon="pi pi-shopping-bag
"
    class="shrink-0 rounded-xl!"
    :label="`${cartStore.totalPrice} ₽`"
    @click="orderStore.openModal"
  />
</template>
