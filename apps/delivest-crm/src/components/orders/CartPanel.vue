<script setup lang="ts">
import { computed } from "vue";
import type { OrderResponse, CartResponse } from "@delivest/types";

type CartItem = OrderResponse["items"][0] | CartResponse["items"][0];

interface Props {
  title: string;
  subtitle: string;
  step?: "1" | "2";
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  isEmpty?: boolean;
  isEditing?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  decrementItem: [productId: string];
  incrementItem: [productId: string];
  removeItem: [productId: string];
}>();

const displayItems = computed(() => props.items);
</script>

<template>
  <aside class="space-y-6">
    <div class="rounded-3xl border border-slate-200 bg-white p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">{{ title }}</div>
          <div class="mt-1 text-sm text-slate-500">{{ subtitle }}</div>
        </div>
        <span v-if="step" class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Шаг {{ step }}
        </span>
      </div>

      <div class="mt-5 space-y-3">
        <template v-if="isEmpty || displayItems.length === 0">
          <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            В корзине пока нет товаров.
          </div>
        </template>

        <template v-else>
          <div class="space-y-3">
            <div
              v-for="item in displayItems"
              :key="item.productId"
              class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <img
                    v-if="'photoUrl' in item && item.photoUrl"
                    :src="item.photoUrl"
                    alt="Фото товара"
                    class="h-12 w-12 rounded-2xl object-cover" />
                  <div>
                    <div class="font-medium">{{ "name" in item ? item.name : item.title }}</div>
                    <div class="mt-1 text-sm text-slate-600">{{ item.price }} ₽ × {{ item.quantity }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <button
                    class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                    @click="emit('decrementItem', item.productId)">
                    -
                  </button>
                  <button
                    class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                    @click="emit('incrementItem', item.productId)">
                    +
                  </button>
                  <button
                    class="rounded-full border border-red-300 px-2 py-1 text-red-600 hover:bg-rose-50"
                    @click="emit('removeItem', item.productId)">
                    x
                  </button>
                </div>
              </div>
              <div class="mt-3 text-sm text-slate-600">
                Сумма: {{ "totalPrice" in item ? item.totalPrice : item.price * item.quantity }} ₽
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div class="flex items-center justify-between text-sm text-slate-600">
        <span>Итого</span>
        <span class="font-semibold text-slate-900">{{ totalPrice }} ₽</span>
      </div>
      <div class="mt-2 text-sm text-slate-500">{{ totalItems }} товаров</div>
    </div>

    <slot name="actions" />
  </aside>
</template>
