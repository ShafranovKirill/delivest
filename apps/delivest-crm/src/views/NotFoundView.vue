<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
    <div class="relative">
      <h1 class="text-[12rem] font-black text-slate-200 select-none animate-pulse">404</h1>
      <p class="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-800 mt-8">
        {{ t("error-view.404.title") }}
      </p>
    </div>

    <div class="max-w-md mt-4">
      <p class="text-slate-500 mb-8">
        {{ t("error-view.404.description") }}
      </p>

      <router-link
        to="/"
        class="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-indigo-200 active:scale-95">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {{ t("error-view.404.back_button") }}
      </router-link>
    </div>

    <div class="mt-16 flex gap-4">
      <div class="w-3 h-3 rounded-full bg-slate-200 animate-bounce" style="animation-delay: 0.1s" />
      <div class="w-3 h-3 rounded-full bg-slate-200 animate-bounce" style="animation-delay: 0.2s" />
      <div class="w-3 h-3 rounded-full bg-slate-200 animate-bounce" style="animation-delay: 0.3s" />
    </div>
  </div>
</template>

<style scoped>
h1 {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>
