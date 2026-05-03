<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth.store";
import { socket } from "./plugins/socket";
const authStore = useAuthStore();
onMounted(() => {
  authStore.init();
  socket.connect();
});
</script>

<template>
  <div
    v-if="!authStore.isInitialized"
    class="fixed inset-0 flex flex-col items-center justify-center bg-surface-ground z-9999">
    <ProgressSpinner style="width: 50px; height: 50px" />
  </div>

  <template v-else>
    <Toast />
    <router-view />
  </template>
</template>
