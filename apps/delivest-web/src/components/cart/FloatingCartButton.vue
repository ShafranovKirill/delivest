<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import { useOrderStore } from '@/stores/order.store'

const cartStore = useCartStore()
const orderStore = useOrderStore()
</script>

<template>
  <div v-if="cartStore.totalItems > 0" class="fixed bottom-5 right-5 z-50 lg:hidden">
    <Button class="shadow-lg rounded-full! px-6! py-4!" @click="orderStore.openModal">
      <div class="flex items-center gap-3">
        <span class="font-bold text-xl">₽{{ cartStore.totalPrice }}</span>

        <i class="pi pi-shopping-cart text-lg! font-bold!" />
      </div>
    </Button>
  </div>
</template>
