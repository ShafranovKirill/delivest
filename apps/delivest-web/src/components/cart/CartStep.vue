<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import CartItem from './CartItem.vue'

const cartStore = useCartStore()
</script>
<template>
  <div class="flex flex-col gap-2">
    <div v-for="cartItem in cartStore.cart?.items" :key="cartItem.productId">
      <CartItem :cart-item="cartItem" />
    </div>
  </div>
</template>
