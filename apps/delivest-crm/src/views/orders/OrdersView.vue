<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useBranchStore } from "@/stores/branch.store";
import { useCategoryStore } from "@/stores/category.store";
import { useOrderStore } from "@/stores/order.store";
import { useProductStore } from "@/stores/product.store";
import { useCartStore } from "@/stores/cart.store";
import OrdersList from "@/components/orders/OrdersList.vue";
import CreateOrderBar from "@/components/orders/CreateOrderBar.vue";
import OrderModal from "@/components/orders/OrderModal.vue";

const branchStore = useBranchStore();
const categoryStore = useCategoryStore();
const orderStore = useOrderStore();
const productStore = useProductStore();
const cartStore = useCartStore();

const orderStep = ref<"CART" | "DETAILS">("CART");

const orderStatusOptions = ["PENDING", "PROCESSING", "READY", "PICKED_UP", "COMPLETED", "CANCELLED"] as const;

const orderStatusLabels: Record<string, string> = {
  PENDING: "Новый",
  PROCESSING: "В обработке",
  READY: "Готов",
  PICKED_UP: "Выдан",
  COMPLETED: "Завершен",
  CANCELLED: "Отменен",
};

type OrderStatusValue = (typeof orderStatusOptions)[number];

const activeBranchId = computed(() => branchStore.activeBranchId);

const cartItems = computed(() => {
  if (orderStore.selectedOrder) {
    return orderStore.selectedOrder.items;
  }
  return cartStore.cart?.items ?? [];
});

const cartTotalPrice = computed(() => {
  if (orderStore.selectedOrder) {
    return orderStore.selectedOrder.totalPrice;
  }
  return cartStore.cart?.totalPrice ?? 0;
});

const cartTotalItems = computed(() => {
  if (orderStore.selectedOrder) {
    return orderStore.selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  return cartStore.cart?.totalItems ?? 0;
});

const isEditingOrder = computed(() => Boolean(orderStore.selectedOrder));

const loadPageData = async () => {
  if (!activeBranchId.value) return;

  await Promise.all([
    categoryStore.fetchByBranch(activeBranchId.value),
    productStore.fetchProductsForBranch(activeBranchId.value),
    cartStore.fetchStaffCart(activeBranchId.value),
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

const handleCreateOrder = (type: string) => {
  orderStore.openOrderModal(type as any);
  orderStep.value = "CART";
};

const handleEditOrder = (order: (typeof orderStore.orders)[number]) => {
  orderStore.openEditOrderModal(order);
  orderStep.value = "DETAILS";
};

const handleUpdateOrderStatus = async (orderId: string, status: string) => {
  await orderStore.updateOrderStatus(orderId, status as OrderStatusValue);
};

const handleCloseModal = () => {
  orderStore.closeOrderModal();
};

const handleGoToCart = () => {
  orderStep.value = "CART";
};

const handleGoToDetails = async () => {
  if (!cartItems.value.length) {
    orderStore.errorMessage = "Добавьте товары в корзину";
    return;
  }

  orderStore.errorMessage = "";
  orderStep.value = "DETAILS";
};

const handleAddProduct = async (productId: string) => {
  if (orderStore.selectedOrder) {
    await orderStore.addProductToOrder(orderStore.selectedOrder.id, productId, 1);
    return;
  }

  await cartStore.addProductToCart(productId, 1);
};

const handleDecrementItem = async (productId: string) => {
  if (orderStore.selectedOrder) {
    await orderStore.removeProductFromOrder(orderStore.selectedOrder.id, productId, false);
    return;
  }

  await cartStore.removeProductFromCart(productId, false);
};

const handleIncrementItem = async (productId: string) => {
  if (orderStore.selectedOrder) {
    await orderStore.addProductToOrder(orderStore.selectedOrder.id, productId, 1);
    return;
  }

  await cartStore.addProductToCart(productId, 1);
};

const handleRemoveItem = async (productId: string) => {
  if (orderStore.selectedOrder) {
    await orderStore.removeProductFromOrder(orderStore.selectedOrder.id, productId, true);
    return;
  }

  await cartStore.removeProductFromCart(productId, true);
};

const handleUpdatePhone = (value: string) => {
  orderStore.orderRequest.phone = value;
};

const handleUpdateTableNumber = (value: string) => {
  orderStore.orderRequest.tableNumber = value;
};

const handleUpdateAddress = (value: string) => {
  orderStore.orderRequest.address = value;
};

const handleUpdateComment = (value: string) => {
  orderStore.orderRequest.comment = value;
};

const handleSubmitOrder = async () => {
  if (isEditingOrder.value) {
    orderStore.closeOrderModal();
    return;
  }

  if (orderStep.value === "CART") {
    await handleGoToDetails();
    return;
  }

  if (!orderStore.validatedOrder) {
    const validationResult = await orderStore.validateStaffOrder();
    if (!validationResult) {
      return;
    }

    return;
  }

  await orderStore.createStaffOrder();
};
</script>

<template>
  <div class="space-y-6 p-6 pb-48">
    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold">Управление заказами</h1>
          <p class="mt-2 text-sm text-slate-500">Создавайте и редактируйте заказы, изменяйте статусы прямо в списке.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button
            class="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            @click="loadPageData">
            Обновить данные
          </button>
        </div>
      </div>
    </section>

    <OrdersList
      :orders="orderStore.orders"
      :is-loading="orderStore.isLoadingOrders"
      :total-count="orderStore.totalOrders"
      :order-status-options="orderStatusOptions"
      :order-status-labels="orderStatusLabels"
      @update-status="handleUpdateOrderStatus"
      @edit="handleEditOrder" />
  </div>

  <CreateOrderBar @create-order="handleCreateOrder" />

  <OrderModal
    :is-open="orderStore.orderModalOpen"
    :step="orderStep"
    :cart-items="cartItems"
    :cart-total-price="cartTotalPrice"
    :cart-total-items="cartTotalItems"
    :products="productStore.products"
    :categories="categoryStore.sortedCategories"
    :is-editing-order="isEditingOrder"
    :selected-order="orderStore.selectedOrder"
    :order-modal-type="orderStore.orderModalType || 'TABLE'"
    :phone="orderStore.orderRequest.phone"
    :table-number="orderStore.orderRequest.tableNumber"
    :address="orderStore.orderRequest.address"
    :comment="orderStore.orderRequest.comment"
    :validated-order="orderStore.validatedOrder"
    :error-message="orderStore.errorMessage"
    :success-message="orderStore.successMessage"
    :is-submitting-order="orderStore.isSubmittingOrder"
    @close="handleCloseModal"
    @go-to-cart="handleGoToCart"
    @go-to-details="handleGoToDetails"
    @add-product="handleAddProduct"
    @decrement-item="handleDecrementItem"
    @increment-item="handleIncrementItem"
    @remove-item="handleRemoveItem"
    @update-phone="handleUpdatePhone"
    @update-table-number="handleUpdateTableNumber"
    @update-address="handleUpdateAddress"
    @update-comment="handleUpdateComment"
    @submit="handleSubmitOrder" />
</template>
