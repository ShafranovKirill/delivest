<script setup lang="ts">
import { useBranchStore } from "@/stores/branch.store";
import { useMenuStore } from "@/stores/state/menu.store";

const branchStore = useBranchStore();
const menuStore = useMenuStore();
</script>

<template>
  <div class="flex min-h-screen bg-surface-ground">
    <div
      v-if="menuStore.isSidebarVisible"
      class="w-64 shrink-0 bg-surface-card border-r border-surface-border sticky top-0 h-screen overflow-y-auto hidden md:block">
      <AppMenu />
    </div>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 flex items-center px-6 bg-surface-card border-b border-surface-border sticky top-0 z-10">
        <Button icon="pi pi-bars" text @click="menuStore.toggleSidebar()" class="mr-4" />
        <div class="font-bold text-lg">
          {{ branchStore.activeBranch?.name || "Delivest" }}
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-4 md:p-8">
        <div class="max-w-350 mx-auto w-full">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>
