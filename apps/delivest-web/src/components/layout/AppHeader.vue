<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useRouter } from 'vue-router'
import StateSetting from '../state/StateSetting.vue'

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
    class="sticky top-0 z-50 w-full border-b border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-900/80 backdrop-blur-md"
  >
    <div class="mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
      <div class="flex gap-5">
        <Button icon="pi pi-bars" @click="isMenuOpen = !isMenuOpen"></Button>
        <Dropdown
          v-model="branchStore.curentBranch"
          :options="branchStore.branches"
          option-label="name"
          placeholder="Выберите филиал"
          @change="onBranchChange"
        ></Dropdown>
      </div>
      <div class="flex gap-1.5">
        <StateSetting />
      </div>
    </div>
  </header>
</template>
