<script setup lang="ts">
import { useMenuStore } from "@/stores/state/menu.store";
import Button from "primevue/button";

const menuStore = useMenuStore();
</script>

<template>
  <header class="bg-surface-card border-b border-surface-border px-4 py-3 flex items-center">
    <div class="flex items-center gap-3 mr-4">
      <Button icon="pi pi-bars" severity="secondary" text @click="menuStore.toggleSidebar" class="hidden md:flex" />
    </div>
    <div id="app-header-slot" class="flex-1">
      <slot />
    </div>
  </header>
</template>
