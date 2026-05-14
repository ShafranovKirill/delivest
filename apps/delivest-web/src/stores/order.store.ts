import api from '@/api/axios'
import type {
  CreateOrderRequest,
  DeliveryTypeValue,
  OrderResponse,
  ValidateOrderRequest,
  ValidateOrderResponse,
} from '@delivest/types'
import { DeliveryType } from '@delivest/common'
import { defineStore } from 'pinia'
import { useBranchStore } from './branch.store'
import { useCartStore } from './cart.store'

export const useOrderStore = defineStore('order', {
  state: () => {
    const branchStore = useBranchStore()
    const cartStore = useCartStore()
    return {
      step: 1,
      isModalVisible: false,
      isOrderLoading: false,
      validationData: null as ValidateOrderResponse | null,
      lastCreatedOrder: null as OrderResponse | null,
      form: {
        phone: '',
        deliveryType: 'PICKUP' as DeliveryTypeValue,
        address: '',
        comment: '',
        branchId: branchStore.curentBranch!.id,
        cartId: cartStore.cart!.id,
      },
    }
  },
  getters: {
    isFormValid: (state) => {
      const { phone, deliveryType, address } = state.form
      const hasPhone = phone.length >= 10

      if (deliveryType === 'DELIVERY') {
        return hasPhone && address.length > 5
      }
      return hasPhone
    },
    validationToken: (state) => state.validationData?.validationToken || null,
    orderPrewiew: (state) => state.validationData,
  },
  actions: {
    async runValidate() {
      const payload: ValidateOrderRequest = {
        ...this.form,
      }

      await this.validate(payload)
      this.step = 3
    },
    async validate(payload: ValidateOrderRequest) {
      this.isOrderLoading = true
      try {
        const { data } = await api.post<ValidateOrderResponse>('/orders/validate', payload)

        this.validationData = data
        this.isModalVisible = true
        return data
      } catch (error) {
        console.error('Validation failed', error)
        throw error
      } finally {
        this.isOrderLoading = false
      }
    },

    async confirmOrder() {
      if (!this.validationToken) return

      this.isOrderLoading = true
      try {
        const payload: CreateOrderRequest = {
          validationToken: this.validationToken,
        }

        const { data } = await api.post<OrderResponse>('/orders', {
          method: 'POST',
          body: payload,
        })

        this.lastCreatedOrder = data
        this.resetAfterSuccess()
        return data
      } catch (error) {
        console.error('Order creation failed', error)
        throw error
      } finally {
        this.isOrderLoading = false
      }
    },
    resetAfterSuccess() {
      this.validationData = null
      this.step = 1
      this.isModalVisible = false
    },
    toggleModal() {
      this.isModalVisible = !this.isModalVisible
    },
    openModal() {
      this.isModalVisible = true
    },
    openModalOnStep(step: number) {
      this.step = step
      this.isModalVisible = true
    },
    closeModal() {
      this.isModalVisible = false
    },
    nextStep() {
      this.step++
    },
    prevStep() {
      this.step--
    },
    resetToFirstStep() {
      this.step = 1
    },
  },
})
