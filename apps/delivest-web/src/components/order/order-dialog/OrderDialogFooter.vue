<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import { useOrderStore } from '@/stores/order.store'
import { computed } from 'vue'

const orderStore = useOrderStore()
const cartStore = useCartStore()

const buttonText = computed(() => {
  if (orderStore.step === 2) return 'К подтверждению'
  if (orderStore.step === 3) return 'Оформить заказ'
  return 'Далее'
})

const isNextDisabled = computed(() => {
  if (orderStore.isOrderLoading) return true

  switch (orderStore.step) {
    case 1:
      return cartStore.totalItems === 0
    case 2:
      return !orderStore.isFormValid
    case 3:
      return !orderStore.validationToken
    case 4:
      return true
    default:
      return false
  }
})

const handleNext = async () => {
  if (orderStore.step === 2) {
    await orderStore.runValidate()
  } else if (orderStore.step === 3) {
    await orderStore.confirmOrder()
  } else {
    orderStore.nextStep()
  }
}
</script>

<template>
  <Button
    class="w-full! h-15 rounded-2xl!"
    :loading="orderStore.isOrderLoading"
    :disabled="isNextDisabled"
    @click="handleNext"
  >
    <div class="flex w-full items-center justify-between px-3">
      <span class="text-lg font-bold">{{ buttonText }}</span>
      <span class="font-extrabold text-xl">{{ cartStore.totalPrice }} ₽</span>
    </div>
  </Button>
</template>
