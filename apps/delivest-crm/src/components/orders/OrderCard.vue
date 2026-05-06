<script setup lang="ts">
import { computed } from "vue";
import type { OrderResponse } from "@delivest/types";

interface Props {
  order: OrderResponse;
  isExpanded: boolean;
  orderStatusOptions: readonly string[];
  orderStatusLabels: Record<string, string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggleExpand: [orderId: string];
  updateStatus: [status: string];
  edit: [];
}>();

const displayItems = computed(() => {
  return props.isExpanded ? props.order.items : props.order.items.slice(0, 2);
});
</script>

<template>
  <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="text-lg font-semibold">Заказ #{{ order.orderNumber }}</div>
        <div class="mt-1 text-sm text-slate-600">{{ order.deliveryType }} • {{ order.comment || order.phone }}</div>
      </div>
      <div class="text-right text-sm text-slate-700">{{ order.totalPrice }} ₽</div>
    </div>

    <!-- Contact Info -->
    <div class="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
      <div>Телефон: {{ order.phone }}</div>
      <div>Клиент: {{ order.clientId ?? "Гость" }}</div>
      <div v-if="order.address">Адрес: {{ order.address }}</div>
      <div v-if="order.comment">Комментарий: {{ order.comment }}</div>
    </div>

    <!-- Status and Edit Button -->
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-slate-700">Статус</label>
        <select
          class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
          :value="order.status"
          @change="emit('updateStatus', ($event.target as HTMLSelectElement).value)">
          <option v-for="status in orderStatusOptions" :key="status" :value="status">
            {{ orderStatusLabels[status] }}
          </option>
        </select>
      </div>

      <button
        class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        @click="emit('edit')">
        Изменить заказ
      </button>
    </div>

    <!-- Order Items -->
    <div class="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
      <div class="flex items-center justify-between">
        <div class="font-medium">Состав заказа</div>
        <button class="text-sm text-slate-500 hover:text-slate-900" @click="emit('toggleExpand', order.id)">
          {{ isExpanded ? "Свернуть" : "Показать состав" }}
        </button>
      </div>

      <div class="mt-3 space-y-3">
        <div
          v-for="item in displayItems"
          :key="item.productId"
          class="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="font-medium">{{ item.title }}</div>
              <div class="mt-1 text-sm text-slate-600">{{ item.quantity }} × {{ item.price }} ₽</div>
            </div>
            <div class="text-sm text-slate-500">
              {{ "totalPrice" in item ? item.totalPrice : item.price * item.quantity }} ₽
            </div>
          </div>
        </div>
      </div>

      <div v-if="order.items.length > 2" class="mt-3 text-sm text-slate-500">
        {{ isExpanded ? "" : `Показаны первые 2 позиции из ${order.items.length}` }}
      </div>
    </div>
  </div>
</template>
