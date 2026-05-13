<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import CartItem from './CartItem.vue'

const cartStore = useCartStore()
</script>
<template>
  <div v-for="cartItem in cartStore.cart?.items" :key="cartItem.productId">
    <CartItem :cart-item="cartItem" />
  </div>
</template>
