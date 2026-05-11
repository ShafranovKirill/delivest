<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const visible = defineModel('visible', { type: Boolean, default: false })
const router = useRouter()
const menuItems = ref([
  {
    label: 'Меню',
    icon: 'pi pi-list',
    command: () => {
      router.push({ name: 'branch-home' })
    },
  },
])
</script>
<template>
  <Sidebar v-model:visible="visible">
    <PanelMenu :model="menuItems"></PanelMenu>
  </Sidebar>
</template>
