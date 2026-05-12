<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'

const count = ref<number>(0)

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
  <div class="flex items-center justify-end h-24 w-full px-4">
    <div
      class="flex items-center justify-end rounded-full bg-white duration-500 ease-in-out overflow-hidden h-12 transition-all shadow-md px-1"
      :class="count > 0 ? 'w-64' : 'w-12'"
    >
      <div
        class="flex items-center flex-1 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap"
        :class="count > 0 ? 'opacity-100' : 'w-0 opacity-0'"
      >
        <Button
          icon="pi pi-minus"
          text
          rounded
          class="w-10 h-10 p-0! text-black! shrink-0 hover:bg-gray-100!"
          @click="decrement"
        />

        <div class="flex-1 text-center min-w-10">
          <Transition name="slide-up" mode="out-in">
            <span :key="count" class="text-xl font-bold text-primary-600 select-none block">
              {{ count }}
            </span>
          </Transition>
        </div>
      </div>

      <Button
        icon="pi pi-plus"
        text
        rounded
        class="w-10 h-10 p-0! text-black! hover:bg-gray-100! shrink-0"
        @click="increment"
      />
    </div>
  </div>
</template>
