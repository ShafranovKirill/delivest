<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>

<template>
  <Dialog
    :style="{ width: '40vw' }"
    :breakpoints="{ '1199px': '65vw', '575px': '90vw' }"
    :closable="false"
    v-model:visible="orderStore.isModalVisible"
    modal
    @hide="orderStore.resetToFirstStep"
  >
    <template #header>
      <OrderDialogHeader />
    </template>
    <template #default>
      <OrderDialogSteps />
    </template>
    <template #footer>
      <OrderDialogFooter />
    </template>
  </Dialog>
</template>
