<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import { useI18n } from "vue-i18n";
import { useProductStore } from "@/stores/product.store";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const { t } = useI18n();
const productStore = useProductStore();

const isCreateVisible = ref(false);

watch(
  () => branchStore.activeBranchId,
  async newId => {
    if (newId) {
      await productStore.fetchProductsForBranch(newId);
    }
  },
);
const branchName = computed(() => branchStore.activeBranch?.name || "");

onMounted(async () => {
  await productStore.fetchProductsForBranch(branchStore.activeBranch?.id ?? "");
});
</script>
<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">{{ t("menu.categories") }}</h1>
        <p class="text-(--surface-500) text-sm mt-2">
          {{ branchName ? `Продукты филиала ${branchName}` : "Выберите филиал, чтобы посмотреть категории" }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="authStore.hasPermission(Permission.CATEGORY_CREATE)"
          :disabled="!branchStore.activeBranchId"
          :label="$t('product.create')"
          icon="pi pi-plus"
          class="py-2 h-fit"
          @click="isCreateVisible = true" />
      </div>
    </div>

    <ProductCreateDialog
      v-model:visible="isCreateVisible"
      :branch-id="branchStore.activeBranchId"
      @created="productStore.fetchProductsForBranch(branchStore.activeBranch?.id ?? '')" />
  </div>
</template>
