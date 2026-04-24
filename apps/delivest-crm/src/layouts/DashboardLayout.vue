<script setup lang="ts">
import { useMenuStore } from "@/stores/state/menu.store";

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
      <main class="flex-1 overflow-y-auto p-4 md:p-8">
        <div class="max-w-350 mx-auto w-full">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>
