import { useBranchStore } from '@/stores/branch.store'
import type { RouteLocationNormalized } from 'vue-router'

export async function branchMiddleware(to: RouteLocationNormalized) {
  const branchStore = useBranchStore()
  const urlAlias = to.params.branchAlias as string | undefined
  const isSelectingPage = to.name === 'branch-selection'
  if (branchStore.branches.length === 0) {
    await branchStore.fetchBranches()
  }

  if (to.name === 'branch-selection') {
    return true
  }

  if (urlAlias) {
    branchStore.setBranchByAlias(urlAlias)
    if (!branchStore.curentBranch) {
      return { name: 'branch-selection' }
    }
    return true
  }
  return true
}
