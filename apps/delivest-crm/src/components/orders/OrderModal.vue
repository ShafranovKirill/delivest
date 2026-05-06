<script setup lang="ts">
import { computed } from "vue";
import type {
  OrderResponse,
  CartResponse,
  ValidateOrderResponse,
  CategoryResponse,
  ProductResponse,
} from "@delivest/types";
import CartStep from "./CartStep.vue";
import DetailsStep from "./DetailsStep.vue";
import CartPanel from "./CartPanel.vue";

type OrderStep = "CART" | "DETAILS";
type OrderModalType = "TABLE" | "TAKEAWAY" | "DELIVERY" | "PICKUP";

interface Props {
  isOpen: boolean;
  step: OrderStep;
  cartItems: (OrderResponse["items"][0] | CartResponse["items"][0])[];
  cartTotalPrice: number;
  cartTotalItems: number;
  products: ProductResponse[];
  categories: CategoryResponse[];
  isEditingOrder: boolean;
  selectedOrder: OrderResponse | null;
  orderModalType: OrderModalType;
  phone: string;
  tableNumber?: string;
  address?: string;
  comment: string;
  validatedOrder: ValidateOrderResponse | null;
  errorMessage: string;
  successMessage: string;
  isSubmittingOrder: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  goToCart: [];
  goToDetails: [];
  addProduct: [productId: string];
  decrementItem: [productId: string];
  incrementItem: [productId: string];
  removeItem: [productId: string];
  updatePhone: [value: string];
  updateTableNumber: [value: string];
  updateAddress: [value: string];
  updateComment: [value: string];
  submit: [];
}>();

const title = computed(() => {
  if (props.isEditingOrder) {
    return `Редактирование заказа #${props.selectedOrder?.orderNumber}`;
  }
  return props.step === "CART" ? "Выберите товары для заказа" : "Данные заказа";
});

const subtitle = computed(() => {
  if (props.isEditingOrder) {
    return "Измените состав и контактные данные заказа.";
  }
  return props.step === "CART"
    ? "Сначала сформируйте корзину, затем подтвердите и заполните данные."
    : "Проверьте данные и нажмите оформить заказ.";
});

const buttonLabel = computed(() => {
  if (props.isEditingOrder) {
    return "Закрыть";
  }
  if (props.step === "CART") {
    return "Подтвердить корзину";
  }
  if (props.isSubmittingOrder) {
    return props.validatedOrder ? "Оформление..." : "Проверка...";
  }
  return props.validatedOrder ? "Оформить заказ" : "Проверить данные";
});

const isButtonDisabled = computed(() => {
  return props.isSubmittingOrder || (!props.isEditingOrder && props.step === "CART" && props.cartItems.length === 0);
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
    <div
      class="mx-auto grid max-w-7xl gap-6 rounded-4xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 lg:grid-cols-[1.7fr_1fr]">
      <!-- Left Panel -->
      <div class="space-y-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-2xl font-semibold">{{ title }}</h2>
            <p class="mt-2 text-sm text-slate-500">{{ subtitle }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              @click="emit('close')">
              Закрыть
            </button>
            <button
              v-if="step === 'DETAILS' && !isEditingOrder"
              class="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              @click="emit('goToCart')">
              Изменить корзину
            </button>
          </div>
        </div>

        <!-- Step Content -->
        <CartStep
          v-if="step === 'CART'"
          :products="products"
          :categories="categories"
          @add-product="emit('addProduct', $event)" />

        <DetailsStep
          v-if="step === 'DETAILS'"
          :phone="phone"
          :table-number="tableNumber"
          :address="address"
          :comment="comment"
          :order-modal-type="orderModalType"
          :validated-order="validatedOrder"
          @update-phone="emit('updatePhone', $event)"
          @update-table-number="emit('updateTableNumber', $event)"
          @update-address="emit('updateAddress', $event)"
          @update-comment="emit('updateComment', $event)" />
      </div>

      <!-- Right Panel - Cart -->
      <CartPanel
        :title="isEditingOrder ? 'Текущий заказ' : 'Корзина заказа'"
        :subtitle="`${cartTotalItems} товаров · ${cartTotalPrice} ₽`"
        :step="step === 'CART' ? '1' : '2'"
        :items="cartItems"
        :total-price="cartTotalPrice"
        :total-items="cartTotalItems"
        :is-empty="cartItems.length === 0"
        @decrement-item="emit('decrementItem', $event)"
        @increment-item="emit('incrementItem', $event)"
        @remove-item="emit('removeItem', $event)">
        <template #actions>
          <div class="space-y-3">
            <button
              class="w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              :disabled="isButtonDisabled"
              @click="emit('submit')">
              {{ buttonLabel }}
            </button>
            <button
              v-if="step === 'DETAILS' && !isEditingOrder"
              class="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="emit('goToCart')">
              Вернуться к корзине
            </button>
            <div
              v-if="successMessage"
              class="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {{ successMessage }}
            </div>
            <div v-if="errorMessage" class="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {{ errorMessage }}
            </div>
          </div>
        </template>
      </CartPanel>
    </div>
  </div>
</template>
