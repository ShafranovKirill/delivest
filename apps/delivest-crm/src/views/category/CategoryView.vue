<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useCategoryList } from "@/composables/useCategoryList";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@delivest/common";
import { useI18n } from "vue-i18n";
import CategoryCard from "@/components/category/CategoryCard.vue";
import CategoryCreateDialog from "@/components/category/CategoryCreateDialog.vue";
import CategoryEditDialog from "@/components/category/CategoryEditDialog.vue";
import CategoryDeleteDialog from "@/components/category/CategoryDeleteDialog.vue";
import type { CategoryResponse } from "@delivest/types";
import draggable from "vuedraggable";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const { t } = useI18n();
const { categoryStore, isLoading, loadCategories } = useCategoryList();

const localCategories = ref<CategoryResponse[]>([]);

const syncLocalCategories = () => {
  localCategories.value = [...categoryStore.sortedCategories];
};

watch(
  () => categoryStore.sortedCategories,
  newVal => {
    localCategories.value = [...newVal];
  },
  { immediate: true },
);

const isCreateVisible = ref(false);
const isEditVisible = ref(false);
const isDeleteVisible = ref(false);
const selectedCategory = ref<CategoryResponse | null>(null);

const categories = computed(() => categoryStore.sortedCategories);
const branchName = computed(() => branchStore.activeBranch?.name || "");
const isEmpty = computed(() => !isLoading.value && categories.value.length === 0 && !!branchStore.activeBranchId);

onMounted(async () => {
  await loadCategories();
  syncLocalCategories();
});

const onDragEnd = async () => {
  const updates = localCategories.value
    .map((cat, index) => ({ id: cat.id, oldOrder: cat.order, newOrder: index }))
    .filter(item => item.oldOrder !== item.newOrder);

  if (updates.length === 0) return;

  try {
    await Promise.all(
      updates.map(update =>
        categoryStore.updateCategory(update.id, {
          categoryId: update.id,
          order: update.newOrder,
        }),
      ),
    );
    await loadCategories();
    syncLocalCategories();
  } catch (error) {
    console.error("Ошибка при сохранении порядка:", error);
    syncLocalCategories();
  }
};

const openEdit = (category: CategoryResponse) => {
  selectedCategory.value = category;
  isEditVisible.value = true;
};

const openDelete = (category: CategoryResponse) => {
  selectedCategory.value = category;
  isDeleteVisible.value = true;
};

const onSaved = async () => {
  await loadCategories();
  selectedCategory.value = null;
};

const onDeleted = async () => {
  await loadCategories();
  selectedCategory.value = null;
};
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-(--surface-900)">{{ t("menu.categories") }}</h1>
        <p class="text-(--surface-500) text-sm mt-2">
          {{ branchName ? `Категории филиала ${branchName}` : "Выберите филиал, чтобы посмотреть категории" }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="authStore.hasPermission(Permission.CATEGORY_CREATE)"
          :disabled="!branchStore.activeBranchId"
          label="Создать категорию"
          icon="pi pi-plus"
          class="py-2 h-fit"
          @click="isCreateVisible = true" />

        <Button
          v-if="authStore.hasPermission(Permission.CATEGORY_READ)"
          label="Обновить"
          icon="pi pi-refresh"
          severity="secondary"
          class="py-2 h-fit"
          @click="loadCategories" />
      </div>
    </div>

    <div class="grid gap-4">
      <template v-if="isLoading">
        <CategoryCard v-for="i in 4" :key="i" loading />
      </template>

      <div
        v-else-if="!branchStore.activeBranchId"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-map-marker text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">Выберите филиал для просмотра категорий.</p>
      </div>

      <div
        v-else-if="isEmpty"
        class="text-center py-12 bg-(--surface-card) border border-dashed border-(--surface-border) rounded-2xl">
        <i class="pi pi-tags text-4xl text-(--surface-300) mb-3"></i>
        <p class="text-(--surface-500)">Для выбранного филиала категории не найдены.</p>
      </div>

      <draggable
        v-else
        v-model="localCategories"
        item-key="id"
        handle=".drag-handle"
        ghost-class="opacity-50"
        @end="onDragEnd"
        class="grid gap-4">
        <template #item="{ element: category }">
          <CategoryCard :category="category">
            <template #actions>
              <Button
                v-if="authStore.hasPermission(Permission.CATEGORY_UPDATE)"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click.stop="openEdit(category)" />
              <Button
                v-if="authStore.hasPermission(Permission.CATEGORY_DELETE)"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click.stop="openDelete(category)" />
            </template>
          </CategoryCard>
        </template>
      </draggable>
    </div>

    <CategoryCreateDialog v-model:visible="isCreateVisible" @created="loadCategories" />
    <CategoryEditDialog v-model:visible="isEditVisible" :category="selectedCategory" @saved="onSaved" />
    <CategoryDeleteDialog v-model:visible="isDeleteVisible" :category="selectedCategory" @deleted="onDeleted" />
  </div>
</template>
