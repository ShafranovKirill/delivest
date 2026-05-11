<script setup lang="ts">
import type { CartItemResponse } from '@delivest/types'
import { ref } from 'vue'

const { cartItem } = defineProps<{
  cartItem: CartItemResponse
}>()
const imageError = ref(false)

const handleImageError = () => {
  imageError.value = true
}
</script>
<template>
  <div class="flex items-center">
    <div class="w-full aspect-square overflow-hidden flex items-center justify-center">
      <img
        v-if="cartItem.photoUrl && !imageError"
        :src="cartItem.photoUrl"
        :alt="cartItem?.name"
        class="w-full h-full object-contain p-2 rounded-3xl"
        @error="handleImageError"
      />

      <div
        v-else
        class="flex flex-col items-center justify-center h-full w-full text-(--p-text-muted-color) bg-(--p-content-background)"
      >
        <i class="pi pi-image text-7xl!"></i>
      </div>
    </div>

    <div class="flex flex-col">
      <h3 class="text-lg font-medium leading-tight text-(--p-text-color)">
        {{ cartItem.name }}
        <span class="text-(--p-text-muted-color) font-normal text-base">
          ({{ cartItem.weight }} г.)
        </span>
      </h3>
      <div class="text-xl font-bold mb-1 text-(--p-text-color)">{{ cartItem.price }} ₽</div>
    </div>
  </div>
</template>
