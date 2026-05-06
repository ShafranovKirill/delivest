<script setup lang="ts">
import { useMenuStore } from "@/stores/state/menu.store";
import Button from "primevue/button";
import AppHeader from "@/components/AppHeader.vue";

const menuStore = useMenuStore();
</script>

<template>
  <div class="flex min-h-screen bg-surface-ground">
    <div
      class="shrink-0 bg-surface-card border-r border-surface-border sticky top-0 h-screen overflow-y-auto transition-all duration-300 ease-in-out hidden md:block"
      :class="menuStore.isSidebarVisible ? 'w-64' : 'w-0'">
      <AppMenu v-if="menuStore.isSidebarVisible" />
    </div>

    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <div class="md:hidden p-4">
        <Button icon="pi pi-bars" @click="menuStore.toggleSidebar" />
      </div>
      <main class="flex-1 overflow-y-auto">
        <div class="max-w-350 mx-auto w-full">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>
