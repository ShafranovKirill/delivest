<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
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
import { useCategoryStore } from "@/stores/category.store";

const branchStore = useBranchStore();
const authStore = useAuthStore();
const { t } = useI18n();
const categoryStore = useCategoryStore();

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
const isHeaderSlotReady = ref(false);

const categories = computed(() => categoryStore.sortedCategories);
const branchName = computed(() => branchStore.activeBranch?.name || "");
const isEmpty = computed(
  () => !categoryStore.isLoading && categories.value.length === 0 && !!branchStore.activeBranchId,
);

onMounted(async () => {
  isHeaderSlotReady.value = !!document.getElementById("app-header-slot");
  await categoryStore.fetchByActiveBranch();
  syncLocalCategories();
});

const onDragEnd = async (event: any) => {
  const { newIndex } = event;
  const draggedItem = localCategories.value[newIndex];

  const prev = localCategories.value[newIndex - 1];
  const next = localCategories.value[newIndex + 1];

  let newOrder: number;

  if (prev && !next) {
    newOrder = prev.order + 1000;
  } else if (!prev && next) {
    newOrder = next.order / 2;
  } else if (prev && next) {
    newOrder = (prev.order + next.order) / 2;
  } else {
    newOrder = 1000;
  }

  try {
    await categoryStore.updateCategory({ categoryId: draggedItem.id, order: newOrder });
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
  await categoryStore.fetchByActiveBranch();
  selectedCategory.value = null;
};

const onDeleted = async () => {
  await categoryStore.fetchByActiveBranch();
  selectedCategory.value = null;
};
</script>

<template>
  <teleport v-if="isHeaderSlotReady" to="#app-header-slot">
    <div class="flex items-center justify-between">
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
          :label="$t('category.create')"
          icon="pi pi-plus"
          class="py-2 h-fit"
          @click="isCreateVisible = true" />
      </div>
    </div>
  </teleport>

  <div class="p-6 max-w-4xl mx-auto">
    <div class="grid gap-4">
      <template v-if="categoryStore.isLoading">
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

    <CategoryCreateDialog v-model:visible="isCreateVisible" @created="categoryStore.fetchByActiveBranch" />
    <CategoryEditDialog v-model:visible="isEditVisible" :category="selectedCategory" @saved="onSaved" />
    <CategoryDeleteDialog v-model:visible="isDeleteVisible" :category="selectedCategory" @deleted="onDeleted" />
  </div>
</template>
