<script setup lang="ts">
import { ref, computed } from "vue";
import type { ProductResponse, CategoryResponse } from "@delivest/types";

interface Props {
  products: ProductResponse[];
  categories: CategoryResponse[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  addProduct: [productId: string];
}>();

const selectedCategoryId = ref<string | null>(null);

const filteredProducts = computed(() => {
  if (!selectedCategoryId.value) {
    return props.products;
  }
  return props.products.filter(product => product.categoryId === selectedCategoryId.value);
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          class="rounded-full border px-4 py-2 text-sm font-medium transition"
          :class="{
            'border-slate-900 bg-slate-900 text-white': selectedCategoryId === null,
            'border-slate-200 bg-slate-100 text-slate-700': selectedCategoryId !== null,
          }"
          @click="selectedCategoryId = null">
          Все
        </button>
        <button
          v-for="category in categories"
          :key="category.id"
          class="rounded-full border px-4 py-2 text-sm font-medium transition"
          :class="{
            'border-slate-900 bg-slate-900 text-white': selectedCategoryId === category.id,
            'border-slate-200 bg-slate-100 text-slate-700': selectedCategoryId !== category.id,
          }"
          @click="selectedCategoryId = category.id">
          {{ category.name }}
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="product in filteredProducts"
          :key="product.id"
          class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="font-semibold">{{ product.name }}</div>
              <div class="mt-1 text-sm text-slate-600">{{ product.price }} ₽</div>
            </div>
            <button
              class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              @click="emit('addProduct', product.id)">
              +
            </button>
          </div>
          <div class="mt-4 text-sm text-slate-600">
            Категория: {{ categories.find(c => c.id === product.categoryId)?.name || "Без категории" }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
