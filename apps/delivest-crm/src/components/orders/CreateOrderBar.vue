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
  <div class="sticky top-0 left-0 right-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm z-50">
    <div class="w-full px-6 py-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Управление заказами</h1>
          <p class="mt-2 text-sm text-slate-500">Создавайте и редактируйте заказы, изменяйте статусы прямо в списке.</p>
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
</template>
