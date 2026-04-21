<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Card from 'primevue/card';
import Button from 'primevue/button';

const { t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();

const handleLogout = () => {
  authStore.logout();
  router.push({ name: 'login' });
};
</script>

<template>
  <div class="min-h-screen bg-(--surface-ground) p-6 flex flex-col items-center">
    
    <div class="w-full max-w-2xl flex justify-between items-center mb-8">
      <h1 class="text-2xl font-bold text-(--text-color) m-0">
        {{ t('dashboard.title') }}
      </h1>
      <Button 
        @click="handleLogout" 
        :label="t('auth.logout_button')" 
        icon="pi pi-sign-out" 
        severity="danger" 
        text 
      />
    </div>

    <Card class="w-full max-w-2xl shadow-sm">
      <template #title>
        <div class="flex items-center gap-3">
          <i class="pi pi-user text-2xl text-blue-500"></i>
          <span>{{ t('dashboard.user_info') }}</span>
        </div>
      </template>
      
      <template #content>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div v-for="(value, key) in authStore.user" :key="key" class="flex flex-col border-b border-(--surface-border) pb-2">
            <span class="text-xs font-semibold uppercase text-(--text-color-secondary) mb-1">
              {{ key }}
            </span>
            <span class="text-lg font-medium text-(--text-color)">
              {{ value || '—' }}
            </span>
          </div>

        </div>
      </template>
      
      <template #footer>
        <p class="text-xs text-(--text-color-secondary) m-0 italic">
          {{ t('dashboard.status_active') }}
        </p>
      </template>
    </Card>

  </div>
</template>