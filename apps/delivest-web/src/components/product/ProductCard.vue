<script setup lang="ts">
import { ImageHelper } from '@/utils/image.utils'
import { PHOTO_KEYS } from '@delivest/common'
import type { ProductResponse } from '@delivest/types'
import { computed, ref } from 'vue'
import CommonCounterRight from '../common/CommonCounterRight.vue'

import { useProductCount } from '@/composables/useProductCount'

const props = defineProps<{
  product: ProductResponse
  loading: boolean
}>()
const { count } = useProductCount(() => props.product.id)
const imageError = ref(false)

const imageUrl = computed(() => {
  if (!props.product?.photos) return null
  return ImageHelper.getProductPhotoUrl(props.product.photos, PHOTO_KEYS.PRODUCT_CARD) || null
})

const handleImageError = () => {
  imageError.value = true
}
</script>

<template>
  <div
    class="flex flex-col h-full border border-(--p-content-border-color) rounded-3xl overflow-hidden bg-(--p-content-background) shadow-sm"
  >
    <template v-if="loading">
      <SkeletonProductCard />
    </template>

    <article v-else class="flex flex-col h-full">
      <div class="w-full relative group">
        <div class="w-full aspect-square overflow-hidden flex items-center justify-center">
          <img
            v-if="imageUrl && !imageError"
            :src="imageUrl"
            :alt="product?.name"
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

        <div class="absolute bottom-4 right-4 left-4 flex justify-end">
          <CommonCounterRight v-model:count="count" />
        </div>
      </div>

      <div class="px-4 py-2 flex flex-col grow">
        <div class="text-xl font-bold mb-1 text-(--p-text-color)">{{ product?.price }} ₽</div>

        <h3 class="text-lg font-medium leading-tight text-(--p-text-color)">
          {{ product?.name }}
          <span v-if="product?.quantity" class="text-(--p-text-muted-color) font-normal text-base">
            ({{ product.quantity }} шт.)
          </span>
        </h3>

        <div
          class="mt-auto py-1 text-sm text-(--p-text-muted-color)"
          :class="{ invisible: !product?.weight }"
        >
          {{ product?.weight }} г
        </div>
      </div>
    </article>
  </div>
</template>
