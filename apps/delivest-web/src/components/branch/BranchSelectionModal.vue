<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useRouter } from 'vue-router'
import BranchCard from './BranchCard.vue'

const branchStore = useBranchStore()
const router = useRouter()

const handleBranchSelect = (alias: string) => {
  router.push({
    name: 'branch-home',
    params: { branchAlias: alias },
  })
  branchStore.closwSelectionModal()
}
</script>

<template>
  <Dialog
    :visible="branchStore.isSelectionModalOpen"
    @update:visible="branchStore.closwSelectionModal()"
    modal
    header="Выберите ресторан"
    :style="{ width: '30rem' }"
    :breakpoints="{ '640px': '95vw' }"
    :pt="{
      root: { class: 'rounded-3xl overflow-hidden' },
      header: { class: 'pb-2' },
    }"
  >
    <div class="flex flex-col gap-3 py-4">
      <BranchCard
        v-for="branch in branchStore.branches"
        :key="branch.alias"
        :branch="branch"
        @select="handleBranchSelect"
      />
    </div>
  </Dialog>
</template>
