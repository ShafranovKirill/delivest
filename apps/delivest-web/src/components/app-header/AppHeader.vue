<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'

const isMenuOpen = defineModel('isMenuOpen', { type: Boolean })
const branchStore = useBranchStore()
</script>
<template>
  <header
    class="fixed top-0 left-0 z-50 w-full border-b border-(--p-content-border-color) bg-(--p-content-background)"
  >
    <div class="mx-auto gap-5 flex h-16 items-center justify-between px-4 lg:px-8">
      <div class="flex gap-5">
        <Button icon="pi pi-bars" @click="isMenuOpen = !isMenuOpen" class="rounded-xl!" />
        <div class="flex" @click="branchStore.openSelectionModal">
          <BranchSelector />
        </div>
      </div>

      <div class="hidden sm:block">
        <CartButton />
      </div>
    </div>
  </header>
  <BranchSelectionModal />
</template>
