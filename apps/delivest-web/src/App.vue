<script setup lang="ts">
import { onMounted } from 'vue'
import { useBranchStore } from './stores/branch.store'

const branchStore = useBranchStore()

onMounted(async () => {
  await branchStore.fetchBranches()
  branchStore.initBranchWatcher()
})
</script>

<template>
  <div v-if="branchStore.isLoading" class="flex items-center justify-center min-h-screen">
    <ProgressSpinner />
  </div>
  <template v-else>
    <Toast />
    <router-view />
  </template>
</template>

<style scoped></style>
