<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import { useOrderStore } from '@/stores/order.store'
import { computed } from 'vue'

const orderStore = useOrderStore()
const cartStore = useCartStore()

const isNextDisabled = computed(() => {
  switch (orderStore.step) {
    case 1:
      return false
    case 2:
      return false
    case 3:
      return false
    case 4:
      return true
    default:
      return false
  }
})
</script>

<template>
  <Button
    class="w-full! h-15 rounded-2xl!"
    icon="pi pi-arrow-right"
    :disabled="isNextDisabled"
    @click="orderStore.nextStep"
  >
    <div class="flex w-full items-center justify-between px-3">
      <span class="text-lg font-bold">Далее</span>
      <div class="flex items-center gap-2">
        <span class="font-extrabold text-xl"> {{ cartStore.totalPrice }} ₽ </span>
      </div>
    </div>
  </Button>
</template>
