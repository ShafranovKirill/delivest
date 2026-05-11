<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useThemeStore } from '@/stores/state/theme.store'
import { useLangStore } from '@/stores/state/lang.store'

const router = useRouter()
const themeStore = useThemeStore()
const langStore = useLangStore()

const handleChangeBranch = () => {
  router.push({ name: 'branch-selection' })
}

const isMenuOpen = defineModel('isMenuOpen', { type: Boolean })
</script>

<template>
  <div class="mt-auto border-t border-surface-200 dark:border-surface-700 pt-4 flex flex-col gap-2">
    <Button
      :label="'Свернуть меню'"
      :icon="'pi pi-chevron-left'"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="isMenuOpen = false"
    />

    <Button
      :label="langStore.currentLocale === 'ru' ? 'English' : 'Русский'"
      icon="pi pi-language"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="langStore.toggleLocale"
    />

    <Button
      :label="themeStore.isDark ? 'Светлая тема' : 'Темная тема'"
      :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="themeStore.toggleTheme"
    />

    <Button
      :label="'Сменить филиал'"
      icon="pi pi-refresh"
      severity="secondary"
      text
      class="w-full justify-start py-2!"
      @click="handleChangeBranch"
    />
  </div>
</template>
