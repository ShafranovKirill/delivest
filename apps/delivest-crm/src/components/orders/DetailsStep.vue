<script setup lang="ts">
import { computed } from "vue";
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
  updateDeliveryType: [value: OrderModalType];
}>();

const deliveryTypeLabels: Record<OrderModalType, string> = {
  TABLE: "За столом",
  TAKEAWAY: "На вынос",
  DELIVERY: "Доставка",
  PICKUP: "Самовывоз",
};

const isPhoneValid = (phone: string) => {
  return phone.trim().length > 0 && /^[+]?[\d\s().-]{10,}$/.test(phone);
};

const isTableNumberValid = (tableNumber?: string) => {
  return tableNumber && tableNumber.trim().length > 0;
};

const isAddressValid = (address?: string) => {
  return address && address.trim().length > 0;
};

const getRequiredFieldsErrors = (): string[] => {
  const errors: string[] = [];

  if (!isPhoneValid(props.phone)) {
    errors.push("Укажите корректный номер телефона");
  }

  if (props.orderModalType === "TABLE" && !isTableNumberValid(props.tableNumber)) {
    errors.push("Укажите номер стола");
  }

  if (props.orderModalType === "DELIVERY" && !isAddressValid(props.address)) {
    errors.push("Укажите адрес доставки");
  }

  return errors;
};

const requiredFieldsErrors = computed(() => getRequiredFieldsErrors());
const hasErrors = computed(() => requiredFieldsErrors.value.length > 0);
</script>

<template>
  <div class="space-y-6">
    <!-- Delivery Type Selection -->
    <div class="rounded-3xl border border-blue-200 bg-blue-50 p-5">
      <div class="mb-3 text-sm font-medium text-blue-700">Способ доставки *</div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          v-for="(label, type) in deliveryTypeLabels"
          :key="type"
          class="rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition"
          :class="{
            'border-blue-600 bg-blue-200 text-blue-900': orderModalType === type,
            'border-blue-200 bg-white text-blue-700 hover:bg-blue-50': orderModalType !== type,
          }"
          @click="emit('updateDeliveryType', type as OrderModalType)">
          {{ label }}
        </button>
      </div>
    </div>

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

    <!-- Validation Errors -->
    <div v-if="hasErrors" class="rounded-3xl border border-rose-200 bg-rose-50 p-5">
      <div class="font-semibold text-rose-900">Ошибки заполнения</div>
      <ul class="mt-3 space-y-2 text-sm text-rose-800">
        <li v-for="(error, index) in requiredFieldsErrors" :key="index" class="flex items-start gap-2">
          <span class="mt-0.5 block h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          {{ error }}
        </li>
      </ul>
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
