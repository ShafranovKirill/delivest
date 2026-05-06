<script setup lang="ts">
import type { ValidateOrderResponse } from "@delivest/types";

type OrderModalType = "TABLE" | "TAKEAWAY" | "DELIVERY" | "PICKUP";

interface Props {
  phone: string;
  tableNumber?: string;
  address?: string;
  comment: string;
  orderModalType: OrderModalType;
  validatedOrder: ValidateOrderResponse | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updatePhone: [value: string];
  updateTableNumber: [value: string];
  updateAddress: [value: string];
  updateComment: [value: string];
}>();
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div class="grid gap-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Телефон</label>
          <input
            :value="phone"
            type="tel"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            placeholder="+7 999 123-45-67"
            @input="emit('updatePhone', ($event.target as HTMLInputElement).value)" />
        </div>

        <div v-if="orderModalType === 'TABLE'">
          <label class="mb-2 block text-sm font-medium text-slate-700">Номер стола</label>
          <input
            :value="tableNumber"
            type="text"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            placeholder="Например, 12"
            @input="emit('updateTableNumber', ($event.target as HTMLInputElement).value)" />
        </div>

        <div v-if="orderModalType === 'DELIVERY'">
          <label class="mb-2 block text-sm font-medium text-slate-700">Адрес</label>
          <input
            :value="address"
            type="text"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            placeholder="Улица, дом, квартира"
            @input="emit('updateAddress', ($event.target as HTMLInputElement).value)" />
        </div>

        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Комментарий</label>
          <textarea
            :value="comment"
            rows="4"
            class="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            placeholder="Дополнительная информация для заказа"
            @input="emit('updateComment', ($event.target as HTMLTextAreaElement).value)" />
        </div>
      </div>
    </div>

    <div v-if="validatedOrder" class="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <div class="font-semibold">Предварительный заказ</div>
      <div class="mt-3 text-sm text-slate-600">
        {{ validatedOrder.totalItems }} товаров · {{ validatedOrder.totalPrice }} ₽
      </div>
      <div class="mt-3 space-y-2 text-sm text-slate-700">
        <div v-for="item in validatedOrder.items" :key="item.productId" class="flex items-center justify-between">
          <span>{{ item.name }}</span>
          <span>{{ item.quantity }} × {{ item.price }} ₽</span>
        </div>
      </div>
    </div>
  </div>
</template>
