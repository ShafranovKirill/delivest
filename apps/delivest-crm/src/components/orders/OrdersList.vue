<script setup lang="ts">
import { ref } from "vue";
import type { OrderResponse } from "@delivest/types";
import OrderCard from "./OrderCard.vue";

interface Props {
  orders: OrderResponse[];
  isLoading: boolean;
  totalCount: number;
  orderStatusOptions: readonly string[];
  orderStatusLabels: Record<string, string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updateStatus: [orderId: string, status: string];
  edit: [order: OrderResponse];
}>();

const expandedOrderIds = ref(new Set<string>());

const toggleOrderExpand = (orderId: string) => {
  if (expandedOrderIds.value.has(orderId)) {
    expandedOrderIds.value.delete(orderId);
  } else {
    expandedOrderIds.value.add(orderId);
  }
};

const isExpanded = (orderId: string) => expandedOrderIds.value.has(orderId);
</script>

<template>
  <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold">Список заказов</h2>
        <p class="text-sm text-slate-500">Здесь отображаются последние заказы выбранного филиала.</p>
      </div>
      <div class="text-sm text-slate-500">Всего: {{ totalCount }}</div>
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          Загрузка заказов...
        </div>
      </template>

      <template v-else-if="orders.length === 0">
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          Заказы не найдены.
        </div>
      </template>

      <template v-else>
        <div class="space-y-4">
          <OrderCard
            v-for="order in orders"
            :key="order.id"
            :order="order"
            :is-expanded="isExpanded(order.id)"
            :order-status-options="orderStatusOptions"
            :order-status-labels="orderStatusLabels"
            @toggle-expand="toggleOrderExpand"
            @update-status="emit('updateStatus', order.id, $event)"
            @edit="emit('edit', order)" />
        </div>
      </template>
    </div>
  </div>
</template>
