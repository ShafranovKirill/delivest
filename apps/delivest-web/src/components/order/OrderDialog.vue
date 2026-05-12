<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'
import { computed } from 'vue'

const orderStore = useOrderStore()
const isNextDisabled = computed(() => {
  switch (orderStore.step) {
    case 1:
      return false
    case 2:
      return false
    case 3:
      return false
    case 4:
      return true
    default:
      return false
  }
})
</script>

<template>
  <Dialog v-model:visible="orderStore.isModalVisible" modal @hide="orderStore.resetToFirstStep">
    <template #header>
      <Button
        v-if="orderStore.step > 1"
        icon="pi pi-arrow-left"
        text
        rounded
        @click="orderStore.prevStep"
      />
      <OrderDialogHeader />
    </template>
    <CartStep v-if="orderStore.step === 1" />
    <OrderFormStep v-if="orderStore.step === 2" />
    <OrderConfirmStep v-if="orderStore.step === 3" />
    <OrderCreatedStep v-if="orderStore.step === 4" />
    <template #footer>
      <Button
        label="Далее"
        icon="pi pi-arrow-right"
        :disabled="isNextDisabled"
        @click="orderStore.nextStep"
      />
    </template>
  </Dialog>
</template>
