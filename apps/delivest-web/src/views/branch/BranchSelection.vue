<script setup lang="ts">
import { useBranchStore } from '@/stores/branch.store'
import { useRouter } from 'vue-router'

const branchStore = useBranchStore()
const router = useRouter()

const selectBranch = (alias: string) => {
  router.push({
    name: 'branch-home',
    params: { branchAlias: alias },
  })
}
</script>
<template>
  <div class="flex flex-col justify-center items-center min-h-screen">
    <Card class="w-full max-w-md">
      <template #title>Выберите филиал:</template>
      <template #content>
        <div class="flex flex-col gap-3">
          <div v-for="branch in branchStore.branches" :key="branch.alias">
            <Button
              icon="pi pi-building"
              :label="branch.name"
              @click="selectBranch(branch.alias)"
              class="w-full"
            ></Button>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
