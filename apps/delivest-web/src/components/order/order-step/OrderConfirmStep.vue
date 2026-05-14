<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
const summary = orderStore.validationData
</script>

<template>
  <div v-if="summary" class="flex flex-col gap-4 py-4">
    <div class="bg-gray-50 p-4 rounded-2xl flex flex-col gap-2">
      <h3 class="font-bold text-lg">Детали заказа</h3>
      <div class="flex justify-between text-sm">
        <span class="opacity-60">Телефон:</span>
        <span>{{ orderStore.form.phone }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="opacity-60">Способ:</span>
        <span>{{ orderStore.form.deliveryType === 'DELIVERY' ? 'Доставка' : 'Самовывоз' }}</span>
      </div>
      <div v-if="orderStore.form.address" class="flex flex-col text-sm border-t pt-2 mt-1">
        <span class="opacity-60">Адрес доставки:</span>
        <span>{{ orderStore.form.address }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="font-bold text-lg">Состав заказа</h3>
      <div v-for="item in summary.items" :key="item.productId">
        <CartItem :cart-item="item" />
      </div>
    </div>

    <div class="border-t pt-4 mt-2">
      <div class="flex justify-between items-center">
        <span class="text-xl font-medium">Итого к оплате:</span>
        <span class="text-2xl font-extrabold">{{ summary.totalPrice }} ₽</span>
      </div>
    </div>
  </div>
</template>
