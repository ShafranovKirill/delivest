<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { ref } from 'vue'

const menuState = ref(false)
</script>
<template>
  <AppHeader v-model:is-menu-open="menuState" />
  <AppSidebar v-model:visible="menuState" />
  <router-view />
</template>
