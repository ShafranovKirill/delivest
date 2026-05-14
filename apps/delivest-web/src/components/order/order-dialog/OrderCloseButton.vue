<script setup lang="ts">
import { useCartStore } from '@/stores/cart.store'
import { useOrderStore } from '@/stores/order.store'
import { useConfirm } from 'primevue'

const cartStore = useCartStore()
const orderStore = useOrderStore()
const confirm = useConfirm()
const clearCartConfirm = () => {
  confirm.require({
    message: 'Вы уверены, что хотите очистить корзину? Все товары будут удалены.',
    header: 'Очистка корзины',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Отмена',
    acceptLabel: 'Очистить',
    rejectClass: 'p-button-secondary p-button-text',
    acceptClass: 'p-button-danger',
    defaultFocus: 'reject',
    accept: async () => {
      await cartStore.clearCart()
      orderStore.closeModal()
    },
  })
}
</script>
<template>
  <div class="flex">
    <Button v-if="orderStore.step === 1" icon="pi pi-trash" @click="clearCartConfirm" text></Button>
    <Button label="Закрыть" @click="orderStore.closeModal" text class="text-slate-400"></Button>
  </div>
  <ConfirmDialog :style="{ width: '90%', maxWidth: '400px' }"></ConfirmDialog>
</template>
