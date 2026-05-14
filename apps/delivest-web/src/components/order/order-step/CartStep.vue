<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
const cartStore = useCartStore()
</script>

<template>
  <div class="flex flex-col gap-3">
    <template v-if="cartStore.cart?.items?.length">
      <div v-for="(cartItem, index) in cartStore.cart.items" :key="cartItem.productId">
        <CartItem :cart-item="cartItem" />
        <Divider v-if="index !== cartStore.cart.items.length - 1" />
      </div>
    </template>

    <div v-else class="flex flex-col items-center justify-center py-10 opacity-60">
      <i class="pi pi-shopping-cart text-5xl mb-4" />
      <span class="text-xl font-medium">Корзина пуста</span>
      <p class="text-sm">Самое время что-нибудь купить!</p>
    </div>
  </div>
</template>
