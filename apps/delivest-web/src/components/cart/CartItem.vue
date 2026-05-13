<script setup lang="ts">
import type { CartItemResponse } from '@delivest/types'
import { ref } from 'vue'
import CommonCounterCenter from '../common/CommonCounterCenter.vue'
import { useProductCount } from '@/composables/useProductCount'

const { cartItem } = defineProps<{
  cartItem: CartItemResponse
}>()
const imageError = ref(false)

const handleImageError = () => {
  imageError.value = true
}
const { count } = useProductCount(() => cartItem.productId)
</script>
<template>
  <div class="flex gap-2 items-center w-full">
    <div class="w-12.5 h-12.5 shrink-0 overflow-hidden rounded-xl bg-(--p-content-background)">
      <img
        v-if="cartItem.photoUrl && !imageError"
        :src="cartItem.photoUrl"
        :alt="cartItem?.name"
        class="w-full h-full object-cover"
        @error="handleImageError"
      />

      <div
        v-else
        class="flex flex-col items-center justify-center h-full w-full text-(--p-text-muted-color) bg-(--p-content-background)"
      >
        <i class="pi pi-image text-7xl!"></i>
      </div>
    </div>

    <div class="flex flex-col grow">
      <h3 class="text-lg font-medium leading-tight text-(--p-text-color)">
        {{ cartItem.name }}
        <span class="text-(--p-text-muted-color) font-normal text-base">
          ({{ cartItem.weight }} г.)
        </span>
      </h3>
      <div class="text-xl font-bold mb-1 text-(--p-text-color)">
        {{ cartItem.price * cartItem.quantity }} ₽
      </div>
    </div>
    <div class="w-fit shrink-0">
      <CommonCounterCenter v-model:count="count" />
    </div>
  </div>
</template>
