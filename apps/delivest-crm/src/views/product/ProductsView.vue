<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import draggable from "vuedraggable";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import { useI18n } from "vue-i18n";
import { useProductStore } from "@/stores/product.store";
import { useCategoryStore } from "@/stores/category.store";
import type { ProductResponse } from "@delivest/types";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const categoryStore = useCategoryStore();
const productStore = useProductStore();
const { t } = useI18n();

const isCreateVisible = ref(false);
const isDeleteVisible = ref(false);
const selectedProduct = ref<ProductResponse | null>(null);
const categoryGroups = ref<Record<string, ProductResponse[]>>({});
const unassignedProducts = ref<ProductResponse[]>([]);
const activeCategory = ref<string | null>(null);

const branchName = computed(() => branchStore.activeBranch?.name || "");
const categories = computed(() => categoryStore.sortedCategories);
const isLoading = computed(() => categoryStore.isLoading || productStore.isLoading);
const isEmpty = computed(() => !isLoading.value && categories.value.length === 0 && !!branchStore.activeBranchId);

const syncLocalProducts = () => {
  const groups: Record<string, ProductResponse[]> = {};
  categories.value.forEach(category => {
    groups[category.id] = [];
  });

  const unassigned: ProductResponse[] = [];
  productStore.products.forEach(product => {
    if (product.categoryId && groups[product.categoryId]) {
      groups[product.categoryId].push(product);
    } else {
      unassigned.push(product);
    }
  });

  Object.values(groups).forEach(items => items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  unassigned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  categoryGroups.value = groups;
  unassignedProducts.value = unassigned;
};

watch(
  () => branchStore.activeBranchId,
  async newBranchId => {
    if (newBranchId) {
      await categoryStore.fetchByActiveBranch();
      await productStore.fetchProductsForBranch(newBranchId);
    } else {
      categoryGroups.value = {};
      unassignedProducts.value = [];
    }
  },
  { immediate: true },
);

watch([() => categories.value, () => productStore.products], syncLocalProducts, { immediate: true, deep: true });

onMounted(async () => {
  if (branchStore.activeBranchId) {
    await categoryStore.fetchByActiveBranch();
    await productStore.fetchProductsForBranch(branchStore.activeBranchId);
  }
});

const toggleCategory = (categoryId: string) => {
  activeCategory.value = activeCategory.value === categoryId ? null : categoryId;
};

const openCreate = () => {
  selectedProduct.value = null;
  isCreateVisible.value = true;
};

const openEdit = (product: ProductResponse) => {
  selectedProduct.value = product;
  isCreateVisible.value = true;
};

const openDelete = (product: ProductResponse) => {
  selectedProduct.value = product;
  isDeleteVisible.value = true;
};

const refreshProducts = async () => {
  if (!branchStore.activeBranchId) return;
  await categoryStore.fetchByActiveBranch();
  await productStore.fetchProductsForBranch(branchStore.activeBranchId);
};

const onDragEnd = async (categoryId: string, event: any) => {
  const { newIndex } = event;
  if (newIndex == null) return;

  const items = categoryId === "unassigned" ? unassignedProducts.value : categoryGroups.value[categoryId];
  const dragged = items[newIndex];
  const prev = items[newIndex - 1];
  const next = items[newIndex + 1];

  let newOrder = 1000;
  if (prev && !next) {
    newOrder = (prev.order ?? 0) + 1000;
  } else if (!prev && next) {
    newOrder = (next.order ?? 0) / 2;
  } else if (prev && next) {
    newOrder = ((prev.order ?? 0) + (next.order ?? 0)) / 2;
  }

  try {
    await productStore.updateProduct({ productId: dragged.id, order: newOrder });
  } catch (error) {
    console.error(t("product.list.drag_order_error"), error);
    syncLocalProducts();
  }
};
</script>
<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">{{ t("menu.products") }}</h1>
        <p class="text-(--surface-500) text-sm mt-2">
          {{
            branchName
              ? t("product.list.select_branch_with_name", { name: branchName })
              : t("product.list.select_branch")
          }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="authStore.hasPermission(Permission.PRODUCT_CREATE)"
          :disabled="!branchStore.activeBranchId"
          :label="$t('product.create')"
          icon="pi pi-plus"
          class="py-2 h-fit"
          @click="openCreate" />
      </div>
    </div>

    <div class="space-y-4">
      <template v-if="isLoading">
        <ProductCard v-for="i in 4" :key="i" loading />
      </template>

      <div
        v-else-if="!branchStore.activeBranchId"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-map-marker text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">{{ t("product.list.select_branch") }}</p>
      </div>

      <div
        v-else-if="isEmpty"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-box text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">{{ t("product.list.empty") }}</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="category in categories"
          :key="category.id"
          class="border border-(--surface-border) rounded-2xl overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-4 bg-(--surface-card) hover:bg-(--surface-100)"
            @click="toggleCategory(category.id)">
            <div class="text-left">
              <div class="font-semibold text-(--surface-900)">{{ category.name }}</div>
              <div class="text-sm text-(--surface-500)">
                {{ categoryGroups[category.id]?.length ?? 0 }} {{ t("product.list.items_count") }}
              </div>
            </div>
            <i class="pi" :class="activeCategory === category.id ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
          </button>

          <div v-show="activeCategory === category.id" class="p-4 space-y-3">
            <template v-if="(categoryGroups[category.id] ?? []).length === 0">
              <div class="text-sm text-(--surface-500)">{{ t("product.list.no_items_in_category") }}</div>
            </template>
            <draggable
              v-else
              v-model="categoryGroups[category.id]"
              item-key="id"
              handle=".drag-handle"
              class="space-y-3"
              ghost-class="opacity-50"
              @end="onDragEnd(category.id, $event)">
              <template #item="{ element: product }">
                <ProductCard :product="product">
                  <template #actions>
                    <Button icon="pi pi-pencil" severity="secondary" text rounded @click.stop="openEdit(product)" />
                    <Button icon="pi pi-trash" severity="danger" text rounded @click.stop="openDelete(product)" />
                  </template>
                </ProductCard>
              </template>
            </draggable>
          </div>
        </div>

        <div v-if="unassignedProducts.length > 0" class="border border-(--surface-border) rounded-2xl overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-4 bg-(--surface-card) hover:bg-(--surface-100)"
            @click="toggleCategory('unassigned')">
            <div class="text-left">
              <div class="font-semibold text-(--surface-900)">{{ t("product.list.no_category") }}</div>
              <div class="text-sm text-(--surface-500)">
                {{ unassignedProducts.length }} {{ t("product.list.items_count") }}
              </div>
            </div>
            <i class="pi" :class="activeCategory === 'unassigned' ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
          </button>

          <div v-show="activeCategory === 'unassigned'" class="p-4 space-y-3">
            <draggable
              v-model="unassignedProducts"
              item-key="id"
              handle=".drag-handle"
              ghost-class="opacity-50"
              @end="onDragEnd('unassigned', $event)">
              <template #item="{ element: product }">
                <ProductCard :product="product">
                  <template #actions>
                    <Button icon="pi pi-pencil" severity="secondary" text rounded @click.stop="openEdit(product)" />
                    <Button icon="pi pi-trash" severity="danger" text rounded @click.stop="openDelete(product)" />
                  </template>
                </ProductCard>
              </template>
            </draggable>
          </div>
        </div>
      </div>
    </div>

    <ProductDialog
      v-model:visible="isCreateVisible"
      :branch-id="branchStore.activeBranchId"
      :product="selectedProduct"
      @success="refreshProducts" />

    <ProductDeleteDialog v-model:visible="isDeleteVisible" :product="selectedProduct" @deleted="refreshProducts" />
  </div>
</template>
