<script setup lang="ts">
import Button from 'primevue/button'

const count = defineModel<number>('count', { default: 0 })

const increment = () => {
  count.value++
}

const decrement = () => {
  if (count.value > 0) {
    count.value--
  }
}
</script>

<template>
  <div class="flex items-center justify-center h-24 w-full px-4">
    <div
      class="flex items-center rounded-full bg-(--p-content-background) duration-500 ease-in-out overflow-hidden h-12 transition-all shadow-sm"
      :class="count > 0 ? 'w-full px-1 justify-between' : 'w-12 justify-center'"
    >
      <div
        class="flex items-center transition-all duration-500 ease-in-out overflow-hidden"
        :class="count > 0 ? 'opacity-100 flex-1' : 'w-0 opacity-0'"
      >
        <Button
          icon="pi pi-minus"
          text
          rounded
          class="w-10 h-10 p-0! shrink-0 text-surface-900! dark:text-surface-0! hover:bg-surface-100! dark:hover:bg-surface-700!"
          @click="decrement"
        />

        <div class="flex-1 overflow-hidden text-center">
          <span :key="count" class="text-xl font-bold text-primary-500 select-none block">
            {{ count }}
          </span>
        </div>
      </div>

      <Button
        icon="pi pi-plus"
        text
        rounded
        class="w-10 h-10 p-0! shrink-0 text-surface-900! dark:text-surface-0! hover:bg-surface-100! dark:hover:bg-surface-700!"
        @click="increment"
      />
    </div>
  </div>
</template>
<style scoped>
:deep(.p-button) {
  flex-shrink: 0;
}
</style>
