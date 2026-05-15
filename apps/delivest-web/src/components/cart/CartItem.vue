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
  <div class="flex gap-3 items-start w-full justify-between overflow-hidden py-1">
    <div class="w-12.5 h-12.5 shrink-0 overflow-hidden rounded-xl bg-(--p-content-background) mt-1">
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
        <i class="pi pi-image text-xl"></i>
      </div>
    </div>

    <div class="flex flex-col grow min-w-0 gap-1">
      <h3
        class="text-base sm:text-lg font-medium leading-tight text-(--p-text-color) wrap-break-word"
      >
        {{ cartItem.name }}
        <span class="text-(--p-text-muted-color) font-normal text-sm sm:text-base">
          ({{ cartItem.weight }} г.)
        </span>
      </h3>

      <div class="text-lg sm:text-xl font-bold text-(--p-text-color)">
        {{ cartItem.price * cartItem.quantity }} ₽
      </div>
    </div>

    <div class="shrink-0 ml-2 mt-1">
      <CommonCounterCenter v-model:count="count" />
    </div>
  </div>
</template>
