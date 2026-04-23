<script setup lang="ts">
import { useAuthStore } from "./stores/auth.store";
const authStore = useAuthStore();
</script>

<template>
  <div
    v-if="!authStore.isInitialized"
    class="fixed inset-0 flex flex-col items-center justify-center bg-surface-ground z-9999">
    <ProgressSpinner style="width: 50px; height: 50px" />
    <span class="mt-4 text-sm text-surface-500 font-medium animate-pulse"></span>
  </div>

  <template v-else>
    <Toast />
    <router-view />
  </template>
</template>
