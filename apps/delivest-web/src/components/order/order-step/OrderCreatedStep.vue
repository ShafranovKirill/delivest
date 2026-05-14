<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { computed } from 'vue'

const branchStore = useBranchStore()

const rawPhone = computed(() => branchStore.curentBranch?.phone || '79255355278')

const formattedPhone = computed(() => {
  const p = rawPhone.value.replace(/\D/g, '')
  if (p.length === 11) {
    return `+7 (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9, 11)}`
  }
  return rawPhone.value
})

const telLink = computed(() => `tel:+${rawPhone.value.replace(/\D/g, '')}`)
</script>

<template>
  <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
    <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
      <i class="pi pi-check text-4xl text-green-600"></i>
    </div>

    <h2 class="mb-2 text-2xl font-bold text-(--p-text-color)">Заказ оформлен!</h2>
    <p class="mb-8 text-base text-(--p-text-muted-color)">
      Мы уже начали его готовить. Если у вас возникли вопросы, пожалуйста, свяжитесь с нами.
    </p>

    <div
      class="w-full rounded-2xl bg-(--p-content-background) border border-(--p-content-border-color) p-6 shadow-sm"
    >
      <span
        class="mb-4 block text-xs font-semibold uppercase tracking-wider text-(--p-text-muted-color)"
      >
        Служба поддержки
      </span>

      <div class="flex flex-col items-center gap-4">
        <span class="text-2xl font-extrabold tracking-tight text-(--p-text-color)">
          {{ formattedPhone }}
        </span>

        <a
          :href="telLink"
          class="flex w-full items-center justify-center gap-3 bg-primary text-primary-contrast px-6 py-4 rounded-xl transition-transform active:scale-95 font-bold shadow-lg shadow-primary/20"
        >
          <i class="pi pi-phone text-lg"></i>
          <span>Позвонить в заведение</span>
        </a>
      </div>
    </div>
  </div>
</template>
