<script setup lang="ts">
import { useOrderStore } from '@/stores/order.store'

const orderStore = useOrderStore()
</script>

<template>
  <div class="flex flex-col gap-4 py-4">
    <div class="flex flex-col gap-2">
      <label>Номер телефона</label>
      <InputMask
        v-model="orderStore.form.phone"
        mask="+7 (999) 999-99-99"
        placeholder="+7 (900) 000-00-00"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label>Способ получения</label>
      <SelectButton
        v-model="orderStore.form.deliveryType"
        :options="[
          { label: 'Доставка', value: 'DELIVERY' },
          { label: 'Самовывоз', value: 'PICKUP' },
          { label: 'В заведении', value: 'DINE_IN' },
        ]"
        optionLabel="label"
        optionValue="value"
      />
    </div>

    <div v-if="orderStore.form.deliveryType === 'DELIVERY'" class="flex flex-col gap-2">
      <label>Адрес доставки</label>
      <InputText v-model="orderStore.form.address" placeholder="Улица, дом, квартира" />
    </div>

    <div class="flex flex-col gap-2">
      <label>Комментарий к заказу</label>
      <Textarea v-model="orderStore.form.comment" rows="3" />
    </div>
  </div>
</template>
