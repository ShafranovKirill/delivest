<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth.store";

const authStore = useAuthStore();

onMounted(async () => {
  await authStore.refresh();

  authStore.setInitialized(true);
});
</script>

<template>
  <div v-if="!authStore.isInitialized">Loading...</div>
  <template v-else>
    <Toast />
    <router-view />
  </template>
</template>
