<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'

const cartStore = useCartStore()
</script>
<template>
  <div class="flex flex-col gap-3">
    <div v-for="(cartItem, index) in cartStore.cart?.items" :key="cartItem.productId">
      <CartItem :cart-item="cartItem" />
      <Divider v-if="index !== cartStore.cart!.items.length - 1" />
    </div>
  </div>
</template>
