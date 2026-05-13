import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useCartStore } from '@/stores/cart.store'
import { useToast } from 'primevue/usetoast'
import type { AxiosError } from 'axios'

export function useProductCount(productId: MaybeRefOrGetter<string>) {
  const cartStore = useCartStore()
  const toast = useToast()

  const count = computed({
    get: () => cartStore.getCountForProduct(toValue(productId).toString()),

    set: async (newValue) => {
      const id = toValue(productId).toString()
      const currentVal = cartStore.getCountForProduct(id)

      try {
        if (newValue > currentVal) {
          await cartStore.addToCart(id, 1)
        } else if (newValue < currentVal) {
          await cartStore.removeFromCart(id, false)
        }
      } catch (e) {
        const error = e as AxiosError<{ message?: string }>
        toast.add({
          severity: 'error',
          summary: 'Ошибка',
          detail: error.response?.data?.message || 'Не удалось обновить корзину',
          life: 3000,
        })
      }
    },
  })

  return { count }
}
