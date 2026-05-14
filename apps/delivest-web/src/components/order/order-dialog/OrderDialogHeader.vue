<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>
<template>
  <div class="flex items-center justify-center w-full relative min-h-12">
    <div class="absolute left-0 z-20">
      <Button
        v-if="orderStore.step > 1"
        icon="pi pi-arrow-left"
        text
        rounded
        class="p-2!"
        @click="orderStore.prevStep"
      />
    </div>

    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <h1 class="text-xl font-black text-slate-700 uppercase tracking-wide m-0 pointer-events-auto">
        <span v-if="orderStore.step === 1">Корзина</span>
        <span v-else-if="orderStore.step === 2">Данные заказа</span>
        <span v-else-if="orderStore.step === 3">Проверка заказа</span>
        <span v-else-if="orderStore.step === 4">Заказ оформлен</span>
      </h1>
    </div>

    <div class="absolute right-0 z-20">
      <OrderCloseButton />
    </div>
  </div>
</template>
