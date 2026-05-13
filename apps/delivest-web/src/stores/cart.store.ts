import api from '@/api/axios'
import type { AddToCartRequest, CartResponse, RemoveFromCartRequest } from '@delivest/types'
import { defineStore } from 'pinia'
import { useBranchStore } from './branch.store'
import { watch } from 'vue'

export const useCartStore = defineStore('cart', {
  state: () => ({
    cart: null as CartResponse | null,
    isLoading: false,
  }),
  getters: {
    totalPrice: (state) => state.cart?.totalPrice ?? 0,
    totalItems: (state) => state.cart?.totalItems ?? 0,
    getCountForProduct: (state) => {
      return (productId: string): number => {
        const item = state.cart?.items.find((i) => i.productId === productId)
        return item ? item.quantity : 0
      }
    },
  },
  actions: {
    initCartWatcher() {
      const branchStore = useBranchStore()

      watch(
        () => branchStore.curentBranch,
        async (newBranch) => {
          if (newBranch?.id) {
            await this.fetchCart()
          } else {
            this.cart = null
          }
        },
        { immediate: true },
      )
    },
    async fetchCart() {
      const branchStore = useBranchStore()
      if (branchStore.branches.length === 0) {
        await branchStore.fetchBranches()
      }
      if (!branchStore.curentBranch) {
        console.log('error fetching cart')
        return
      }
      this.isLoading = true
      try {
        const { data } = await api.get<CartResponse>(`/cart/${branchStore.curentBranch?.id}`)
        this.cart = data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async addToCart(productId: string, quantity: number) {
      if (!this.cart) {
        await this.fetchCart
      }
      this.isLoading = true
      try {
        const payload: AddToCartRequest = {
          cartId: this.cart!.id,
          productId,
          quantity,
        }
        const { data } = await api.post<CartResponse>('/cart/add', payload)
        this.cart = data
        return data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
    async removeFromCart(productId: string, deleteAll: boolean) {
      if (!this.cart) {
        await this.fetchCart
      }
      this.isLoading = true
      try {
        const payload: RemoveFromCartRequest = {
          cartId: this.cart!.id,
          productId,
          deleteAll,
        }
        const { data } = await api.patch<CartResponse>('/cart/remove', payload)
        this.cart = data
        return data
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
    async clearCart() {
      if (!this.cart) {
        return
      }

      this.isLoading = true

      try {
        await api.delete(`/cart/clear/${this.cart.id}`)
        this.cart = null
      } catch (error) {
        throw error
      } finally {
        this.isLoading = false
      }
    },
  },
})
