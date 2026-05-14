<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>
<template>
  <div class="flex items-center justify-between w-full min-h-12 gap-2">
    <div class="flex justify-start min-w-10">
      <Button
        v-if="orderStore.step > 1"
        icon="pi pi-arrow-left"
        text
        rounded
        class="p-2!"
        @click="orderStore.prevStep"
      />
    </div>

    <div class="flex-1 text-center overflow-hidden">
      <h1 class="text-lg sm:text-xl font-black text-slate-700 uppercase tracking-wide m-0 truncate">
        <span v-if="orderStore.step === 1">Корзина</span>
        <span v-else-if="orderStore.step === 2">Данные</span>
        <span v-else-if="orderStore.step === 3">Проверка</span>
        <span v-else-if="orderStore.step === 4">Готово</span>
      </h1>
    </div>

    <div class="flex justify-end min-w-10">
      <OrderCloseButton />
    </div>
  </div>
</template>
