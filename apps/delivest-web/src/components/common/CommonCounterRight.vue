<script setup lang="ts">
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
  <div class="flex items-center justify-end w-full">
    <div
      class="flex items-center bg-(--p-content-background) justify-end rounded-full duration-500 ease-in-out overflow-hidden h-12 transition-all shadow-md px-1 bg-surface-0 dark:bg-surface-800"
      :class="count > 0 ? 'w-full max-w-64' : 'w-12'"
    >
      <div
        class="flex items-center flex-1 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap"
        :class="count > 0 ? 'opacity-100' : 'w-0 opacity-0'"
      >
        <Button
          icon="pi pi-minus"
          text
          rounded
          class="w-10 h-10 p-0! shrink-0 text-surface-900! dark:text-surface-0! hover:bg-surface-100! dark:hover:bg-surface-700!"
          @click="decrement"
        />

        <div class="flex-1 text-center">
          <span :key="count" class="text-xl font-bold text-primary-600 select-none block">
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
