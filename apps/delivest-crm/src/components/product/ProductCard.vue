<script setup lang="ts">
import { ImageHelper } from "@/utils/image.utils";
import { PHOTO_KEYS } from "@delivest/common";
import type { ProductResponse } from "@delivest/types";
import { computed } from "vue";

interface Props {
  product?: ProductResponse;
  loading?: boolean;
}

const props = defineProps<Props>();

const imageUrl = computed(() => {
  return ImageHelper.getProductPhotoUrl(props.product?.photos, PHOTO_KEYS.PRODUCT_PREVIEW);
});
</script>

<template>
  <div
    v-if="props.loading"
    class="h-28 bg-(--surface-card) border border-(--surface-border) rounded-2xl p-4 flex items-center gap-4 animate-pulse">
    <div class="w-20 h-20 rounded-xl bg-(--surface-200)"></div>
    <div class="flex-1 space-y-3">
      <div class="h-5 bg-(--surface-200) rounded w-1/2"></div>
      <div class="h-4 bg-(--surface-200) rounded w-3/4"></div>
      <div class="h-4 bg-(--surface-200) rounded w-1/4"></div>
    </div>
  </div>

  <div
    v-else-if="props.product"
    class="group relative p-3 rounded-2xl flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:border-primary/30 bg-(--surface-card) border border-(--surface-border)">
    <div
      class="drag-handle cursor-grab active:cursor-grabbing px-1 text-(--surface-300) hover:text-primary transition-colors">
      <i class="pi pi-ellipsis-v text-lg"></i>
    </div>

    <div class="relative w-20 h-20 shrink-0">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        class="w-full h-full object-cover rounded-xl shadow-sm border border-(--surface-100)"
        :alt="props.product.name" />
      <div
        v-else
        class="w-full h-full bg-(--surface-100) rounded-xl flex items-center justify-center border border-(--surface-200)">
        <i class="pi pi-image text-(--surface-400) text-2xl"></i>
      </div>
    </div>

    <div class="flex-1 min-w-0 py-1">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-bold text-(--surface-900) text-lg truncate leading-tight">
            {{ props.product.name }}
          </h3>
          <div class="text-right shrink-0">
            <span class="font-black text-primary text-lg">
              {{ props.product.price.toLocaleString("ru-RU") }}<span class="text-sm ml-0.5">₽</span>
            </span>
          </div>
        </div>

        <p v-if="props.product.description" class="text-sm text-(--surface-500) line-clamp-1 mb-2">
          {{ props.product.description }}
        </p>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-(--surface-100) rounded-md border border-(--surface-200)">
          <i class="pi pi-box text-[10px] text-(--surface-500)"></i>
          <span class="text-xs font-medium text-(--surface-600)">{{ props.product.quantity ?? 0 }} шт.</span>
        </div>

        <div
          v-if="props.product.weight"
          class="flex items-center gap-1.5 px-2 py-0.5 bg-(--surface-100) rounded-md border border-(--surface-200)">
          <i class="pi pi-tag text-[10px] text-(--surface-500)"></i>
          <span class="text-xs font-medium text-(--surface-600)">{{ props.product.weight }} г</span>
        </div>
      </div>
    </div>

    <div
      class="flex flex-col items-center gap-1 self-stretch justify-center pl-2 border-l border-(--surface-100)"
      @click.stop>
      <slot name="actions" :product="props.product" />
    </div>
  </div>
</template>
