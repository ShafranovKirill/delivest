<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import { useCategoryStore } from "@/stores/category.store";
import { useOrderStore } from "@/stores/order.store";
import { useProductStore } from "@/stores/product.store";

const branchStore = useBranchStore();
const categoryStore = useCategoryStore();
const orderStore = useOrderStore();
const productStore = useProductStore();

const selectedCategoryId = ref<string | null>(null);

const filteredProducts = computed(() => {
  if (!selectedCategoryId.value) {
    return productStore.products;
  }

  return productStore.products.filter(product => product.categoryId === selectedCategoryId.value);
});

const orderButtons = [
  { label: "За столом", type: "TABLE" },
  { label: "На вынос", type: "TAKEAWAY" },
  { label: "Доставка", type: "DELIVERY" },
  { label: "Самовывоз", type: "PICKUP" },
] as const;

type OrderButtonType = (typeof orderButtons)[number]["type"];

const activeBranchId = computed(() => branchStore.activeBranchId);

const loadPageData = async () => {
  if (!activeBranchId.value) return;

  await Promise.all([
    categoryStore.fetchByBranch(activeBranchId.value),
    productStore.fetchProductsForBranch(activeBranchId.value),
    orderStore.fetchStaffCart(activeBranchId.value),
    orderStore.fetchOrdersForBranch(activeBranchId.value),
  ]);
};

onMounted(() => {
  orderStore.initSocketListeners();
  if (activeBranchId.value) {
    loadPageData();
  }
});

watch(activeBranchId, async branchId => {
  if (!branchId) return;
  await loadPageData();
});

const openOrderModal = (type: OrderButtonType) => {
  orderStore.openOrderModal(type);
};

const createOrder = async () => {
  await orderStore.createStaffOrder();
};
</script>

<template>
  <div class="space-y-6 p-6">
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Управление заказами</h1>
          <p class="mt-2 text-sm text-slate-500">
            Создавайте заказы через обычную корзину, выбирайте товары по категориям и редактируйте содержимое до
            оформления.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            class="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            @click="loadPageData">
            Обновить данные
          </button>
          <button
            v-if="orderStore.orderCart?.items.length"
            class="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
            @click="orderStore.clearStaffCart">
            Очистить корзину
          </button>
        </div>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">Список заказов</h2>
              <p class="text-sm text-slate-500">Здесь отображаются последние заказы выбранного филиала.</p>
            </div>
            <div class="text-sm text-slate-500">Всего: {{ orderStore.totalOrders }}</div>
          </div>

          <div class="mt-6 space-y-4">
            <template v-if="orderStore.isLoadingOrders">
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Загрузка заказов...
              </div>
            </template>

            <template v-else-if="orderStore.orders.length === 0">
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Заказы не найдены.
              </div>
            </template>

            <template v-else>
              <div class="space-y-4">
                <div
                  v-for="order in orderStore.orders"
                  :key="order.id"
                  class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div class="text-lg font-semibold">Заказ #{{ order.orderNumber }}</div>
                      <div class="mt-1 text-sm text-slate-600">{{ order.deliveryType }} • {{ order.status }}</div>
                    </div>
                    <div class="text-right text-sm text-slate-700">{{ order.totalPrice }} ₽</div>
                  </div>

                  <div class="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
                    <div>Телефон: {{ order.phone }}</div>
                    <div v-if="order.address">Адрес: {{ order.address }}</div>
                    <div v-if="order.comment">Комментарий: {{ order.comment }}</div>
                  </div>

                  <div class="mt-4 space-y-2 text-sm">
                    <div class="font-medium">Товары</div>
                    <div class="space-y-3">
                      <div
                        v-for="item in order.items"
                        :key="item.productId"
                        class="rounded-2xl border border-slate-200 bg-white p-3">
                        <div class="flex items-center justify-between gap-4">
                          <div>{{ item.title }}</div>
                          <div class="text-slate-600">x{{ item.quantity }}</div>
                        </div>
                        <div class="text-slate-500">Цена: {{ item.price }} ₽</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <aside class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold">Корзина сотрудника</h2>
          <p class="mt-2 text-sm text-slate-500">Добавляйте товары и редактируйте содержимое до оформления заказа.</p>

          <div class="mt-6 space-y-4">
            <template v-if="orderStore.isLoadingCart">
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Загрузка корзины...
              </div>
            </template>

            <template v-else-if="!orderStore.orderCart || orderStore.orderCart.items.length === 0">
              <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Корзина пуста.
              </div>
            </template>

            <template v-else>
              <div class="space-y-4">
                <div
                  v-for="item in orderStore.orderCart.items"
                  :key="item.productId"
                  class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="font-medium">{{ item.name }}</div>
                      <div class="mt-1 text-sm text-slate-600">{{ item.quantity }} × {{ item.price }} ₽</div>
                    </div>
                    <div class="flex items-center gap-2 text-sm">
                      <button
                        class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                        @click="orderStore.removeProductFromCart(item.productId, false)">
                        -
                      </button>
                      <button
                        class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                        @click="orderStore.addProductToCart(item.productId, 1)">
                        +
                      </button>
                      <button
                        class="rounded-full border border-red-300 px-2 py-1 text-red-600 hover:bg-rose-50"
                        @click="orderStore.removeProductFromCart(item.productId, true)">
                        x
                      </button>
                    </div>
                  </div>
                  <div class="mt-3 text-sm text-slate-600">Сумма: {{ item.totalPrice }} ₽</div>
                </div>

                <div class="rounded-3xl border border-slate-200 bg-slate-100 p-4">
                  <div class="flex items-center justify-between text-sm text-slate-600">
                    <span>Итого</span>
                    <span class="font-semibold text-slate-900">{{ orderStore.orderCart.totalPrice }} ₽</span>
                  </div>
                  <div class="mt-2 text-sm text-slate-500">{{ orderStore.orderCart.totalItems }} товаров</div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </aside>
    </section>

    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-xl font-semibold">Создать заказ</h2>
          <p class="mt-2 text-sm text-slate-500">
            Нажмите одну из кнопок, чтобы открыть модальное окно оформления заказа.
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          v-for="button in orderButtons"
          :key="button.type"
          class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          @click="openOrderModal(button.type)">
          {{ button.label }}
        </button>
      </div>
    </section>

    <div
      v-if="orderStore.orderModalOpen"
      class="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-sm">
      <div
        class="mx-auto grid max-w-7xl gap-6 rounded-[32px] bg-white p-6 shadow-2xl ring-1 ring-slate-200 lg:grid-cols-[1.7fr_1fr]">
        <div class="space-y-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-semibold">{{ orderStore.activeOrderTypeLabel }}</h2>
              <p class="mt-2 text-sm text-slate-500">
                Выбирайте товары по категориям и добавляйте их в корзину перед созданием заказа.
              </p>
            </div>
            <button
              class="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              @click="orderStore.closeOrderModal">
              Закрыть
            </button>
          </div>

          <div>
            <div class="mb-3 flex flex-wrap gap-2">
              <button
                class="rounded-full border px-4 py-2 text-sm font-medium transition"
                :class="
                  selectedCategoryId === null
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-700'
                "
                @click="selectedCategoryId = null">
                Все
              </button>
              <button
                v-for="category in categoryStore.sortedCategories"
                :key="category.id"
                class="rounded-full border px-4 py-2 text-sm font-medium transition"
                :class="
                  selectedCategoryId === category.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-700'
                "
                @click="selectedCategoryId = category.id">
                {{ category.name }}
              </button>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="product in filteredProducts"
                :key="product.id"
                class="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="font-semibold">{{ product.name }}</div>
                    <div class="mt-1 text-sm text-slate-600">{{ product.price }} ₽</div>
                  </div>
                  <button
                    class="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    @click="orderStore.addProductToCart(product.id, 1)">
                    +
                  </button>
                </div>
                <div class="mt-4 text-sm text-slate-600">
                  Категория: {{ categoryStore.getCategoryById(product.categoryId)?.name || "Без категории" }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside class="space-y-6">
          <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div class="text-lg font-semibold">Корзина</div>
            <div class="mt-4 space-y-3">
              <template v-if="!orderStore.orderCart || orderStore.orderCart.items.length === 0">
                <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-600">
                  В корзине пока нет товаров.
                </div>
              </template>

              <template v-else>
                <div class="space-y-3">
                  <div
                    v-for="item in orderStore.orderCart.items"
                    :key="item.productId"
                    class="rounded-3xl border border-slate-200 bg-white p-4">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <div class="font-medium">{{ item.name }}</div>
                        <div class="mt-1 text-sm text-slate-600">{{ item.price }} ₽ × {{ item.quantity }}</div>
                      </div>
                      <div class="flex items-center gap-2 text-sm">
                        <button
                          class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                          @click="orderStore.removeProductFromCart(item.productId, false)">
                          -
                        </button>
                        <button
                          class="rounded-full border border-slate-300 px-2 py-1 hover:bg-slate-100"
                          @click="orderStore.addProductToCart(item.productId, 1)">
                          +
                        </button>
                        <button
                          class="rounded-full border border-red-300 px-2 py-1 text-red-600 hover:bg-rose-50"
                          @click="orderStore.removeProductFromCart(item.productId, true)">
                          x
                        </button>
                      </div>
                    </div>
                    <div class="mt-3 text-sm text-slate-600">Сумма: {{ item.totalPrice }} ₽</div>
                  </div>
                </div>
              </template>
            </div>

            <div class="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Итого</span>
                <span class="font-semibold text-slate-900">{{ orderStore.orderCart?.totalPrice ?? 0 }} ₽</span>
              </div>
              <div class="mt-2 text-sm text-slate-500">{{ orderStore.orderCart?.totalItems ?? 0 }} товаров</div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 bg-white p-5">
            <div class="text-lg font-semibold">Данные заказа</div>
            <div class="mt-4 space-y-4">
              <div>
                <label class="mb-2 block text-sm font-medium text-slate-700">Телефон</label>
                <input
                  v-model="orderStore.orderRequest.phone"
                  type="tel"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  placeholder="Например, +7 999 123-45-67" />
              </div>

              <div v-if="orderStore.orderModalType === 'TABLE'">
                <label class="mb-2 block text-sm font-medium text-slate-700">Номер стола</label>
                <input
                  v-model="orderStore.orderRequest.tableNumber"
                  type="text"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  placeholder="Например, 12" />
              </div>

              <div v-if="orderStore.orderModalType === 'DELIVERY'">
                <label class="mb-2 block text-sm font-medium text-slate-700">Адрес</label>
                <input
                  v-model="orderStore.orderRequest.address"
                  type="text"
                  class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  placeholder="Улица, дом, квартира" />
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium text-slate-700">Комментарий</label>
                <textarea
                  v-model="orderStore.orderRequest.comment"
                  rows="4"
                  class="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  placeholder="Дополнительная информация для заказа" />
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button
              class="w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              @click="createOrder"
              :disabled="orderStore.isSubmittingOrder || !orderStore.orderCart?.items.length">
              {{ orderStore.isSubmittingOrder ? "Создание заказа..." : "Создать заказ" }}
            </button>
            <div
              v-if="orderStore.successMessage"
              class="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {{ orderStore.successMessage }}
            </div>
            <div
              v-if="orderStore.errorMessage"
              class="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {{ orderStore.errorMessage }}
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
