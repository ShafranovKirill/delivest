<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useRouter } from 'vue-router'

const router = useRouter()
const branchStore = useBranchStore()
const isMenuOpen = defineModel('isMenuOpen', { type: Boolean })

const onBranchChange = (e: { value: { alias: string } }) => {
  if (e.value && e.value.alias) {
    router.push({
      name: 'branch-home',
      params: { branchAlias: e.value.alias },
    })
  }
}
</script>
<template>
  <header
    class="sticky top-0 z-50 w-full border-b border-(--p-content-border-color) bg-(--p-content-background)/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-16 max-w-360 items-center justify-between px-4 lg:px-8">
      <div class="flex gap-5">
        <Button icon="pi pi-bars" @click="isMenuOpen = !isMenuOpen" />

        <Dropdown
          v-model="branchStore.curentBranch"
          :options="branchStore.branches"
          option-label="name"
          placeholder="Выберите филиал"
          @change="onBranchChange"
          class="w-full md:w-60"
        />
      </div>

      <div class="flex gap-1.5">
        <CartButton />
      </div>
    </div>
  </header>
</template>
