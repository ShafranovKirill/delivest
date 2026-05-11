<script setup lang="ts">
import { useLangStore } from '@/stores/state/lang.store'
import { useThemeStore } from '@/stores/state/theme.store'

const themeStore = useThemeStore()
const langStore = useLangStore()
</script>
<template>
  <Button
    :label="langStore.currentLocale === 'ru' ? 'EN' : 'RU'"
    icon="pi pi-language"
    severity="secondary"
    text
    class="w-full justify-start py-2!"
    @click="langStore.toggleLocale"
  />
  <Button
    :icon="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'"
    severity="secondary"
    text
    class="w-full justify-start py-2!"
    @click="themeStore.toggleTheme"
  />
</template>
