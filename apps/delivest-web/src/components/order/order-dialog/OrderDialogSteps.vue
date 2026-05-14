<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>
<template>
  <CartStep v-if="orderStore.step === 1" />
  <OrderFormStep v-if="orderStore.step === 2" />
  <OrderConfirmStep v-if="orderStore.step === 3" />
  <OrderCreatedStep v-if="orderStore.step === 4" />
</template>
