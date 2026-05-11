import { useBranchStore } from '@/stores/branch.store'
import { createRouter, createWebHistory } from 'vue-router'
import { branchMiddleware } from './middleware/branch.middleware'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'branch-selection',
      component: () => import('@/views/branch/BranchSelection.vue'),
    },
    {
      path: '/:branchAlias',
      component: () => import('@/layouts/BranchLayout.vue'),
      children: [
        {
          path: '',
          name: 'branch-home',
          component: () => import('../views/HomeView.vue'),
        },
      ],
    },
  ],
})
router.beforeEach(branchMiddleware)

export default router
