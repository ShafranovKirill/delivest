<script setup lang="ts">
type OrderButtonType = "TABLE" | "TAKEAWAY" | "DELIVERY" | "PICKUP";

const orderButtons = [
  { label: "За столом", type: "TABLE" },
  { label: "На вынос", type: "TAKEAWAY" },
  { label: "Доставка", type: "DELIVERY" },
  { label: "Самовывоз", type: "PICKUP" },
] as const;

const emit = defineEmits<{
  createOrder: [type: OrderButtonType];
}>();
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-6 shadow-2xl z-50">
    <div class="mx-auto w-full max-w-[calc(100vw-16rem)]">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-xl font-semibold">Создать заказ</h2>
          <p class="mt-2 text-sm text-slate-500">
            Нажмите одну из кнопок, чтобы открыть модальное окно оформления заказа.
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          v-for="button in orderButtons"
          :key="button.type"
          class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          @click="emit('createOrder', button.type)">
          {{ button.label }}
        </button>
      </div>
    </div>
  </div>

  <div class="h-40" />
</template>
