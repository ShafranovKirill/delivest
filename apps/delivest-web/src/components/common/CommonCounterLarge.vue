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
  <div class="flex items-center justify-center w-full">
    <div
      class="flex items-center rounded-full bg-(--p-content-background) w-full px-1 ease-in-out overflow-hidden h-10 border border-(--p-content-border-color) shadow-sm"
    >
      <div class="flex items-center" :class="count > 0 ? 'opacity-100 flex-1' : 'w-0 opacity-0'">
        <Button
          icon="pi pi-minus"
          text
          rounded
          class="w-8! h-8! p-0! shrink-0 text-(--p-text-color)!"
          @click="decrement"
        />

        <div class="flex-1 text-center min-w-0">
          <span :key="count" class="text-lg font-bold select-none">
            {{ count }}
          </span>
        </div>
      </div>

      <Button
        text
        class="h-8 p-0! shrink-0 text-(--p-text-color)! justify-center"
        :class="count > 0 ? 'w-8 rounded-full' : 'w-full px-2 justify-center'"
        @click="increment"
      >
        <template #default>
          <div class="flex items-center justify-center gap-1.5 min-w-0">
            <span v-if="count === 0" class="text-[14px] font-bold uppercase truncate">
              Добавить
            </span>
            <i class="pi pi-plus text-sm shrink-0"></i>
          </div>
        </template>
      </Button>
    </div>
  </div>
</template>
