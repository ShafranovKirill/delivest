<script setup lang="ts">
import { ref } from 'vue'

const menuState = ref(false)
</script>
<template>
  <AppHeader v-model:is-menu-open="menuState" />
  <AppSidebar v-model:visible="menuState" />
  <main class="max-w-420 pt-16 mx-auto px-4 sm:px-6 lg:px-8 w-full">
    <router-view />
  </main>
  <AppFooter />

  <OrderDialog />
</template>
