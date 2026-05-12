<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>
<template>
  <div v-if="orderStore.step === 1">Состав корзины</div>
  <div v-if="orderStore.step === 2">Данные заказа</div>
  <div v-if="orderStore.step === 3">Проверка заказа</div>
  <div v-if="orderStore.step === 4">Заказ оформлен</div>
</template>
