<script setup lang="ts">
import { useMenuStore } from "@/stores/state/menu.store";
import Button from "primevue/button";

const menuStore = useMenuStore();
</script>

<template>
  <header class="bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Button icon="pi pi-bars" severity="secondary" text @click="menuStore.toggleSidebar" class="hidden md:flex" />
      <div id="app-header-slot">
        <slot />
      </div>
    </div>
  </header>
</template>
