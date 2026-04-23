<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToast } from "primevue/usetoast";

import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";
import { useAuth } from "@/hooks/useAuth";
import axios from "axios";
import type { ApiError } from "@/types/api";

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const { login } = useAuth();

const loading = ref(false);
const form = reactive({
  login: "",
  password: "",
});

const handleLogin = async () => {
  try {
    await login.mutateAsync({
      login: form.login,
      password: form.password,
    });

    toast.add({
      severity: "success",
      summary: t("auth.success_title"),
      life: 3000,
    });

    await router.push({ name: "dashboard" });
  } catch (error) {
    let errorMessage = t("auth.login_error");

    if (axios.isAxiosError<ApiError>(error)) {
      errorMessage = error.response?.data?.message ?? errorMessage;
    }

    toast.add({
      severity: "error",
      summary: t("auth.error_title"),
      detail: errorMessage,
      life: 5000,
    });
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-(--surface-ground) p-4">
    <Card class="w-full max-w-[24rem] shadow-lg">
      <template #title>
        <h2 class="m-0 text-center text-2xl font-semibold text-(--text-color)">
          {{ t("auth.login_title") }}
        </h2>
      </template>

      <template #content>
        <form class="flex flex-col gap-6" @submit.prevent="handleLogin">
          <div class="flex flex-col gap-2">
            <label for="login" class="text-sm font-medium text-(--text-color-secondary)">
              {{ t("auth.login_label") }}
            </label>
            <InputText
              id="login"
              v-model="form.login"
              :placeholder="t('auth.login_placeholder')"
              required
              :disabled="loading"
              class="w-full" />
          </div>

          <div class="flex flex-col gap-2">
            <label for="password" class="text-sm font-medium text-(--text-color-secondary)">
              {{ t("auth.password_label") }}
            </label>
            <Password
              id="password"
              v-model="form.password"
              :feedback="false"
              toggle-mask
              required
              :placeholder="t('auth.password_placeholder')"
              :disabled="loading"
              class="w-full"
              input-class="w-full" />
          </div>

          <Button type="submit" :label="t('auth.login_button')" :loading="loading" class="w-full mt-2" />
        </form>
      </template>
    </Card>
  </div>
</template>
