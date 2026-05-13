<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="mt-auto border-t border-gray-100 bg-white">
    <div class="mx-auto max-w-360 px-4 py-24 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-16 lg:grid-cols-3">
        <div class="space-y-6">
          <div class="flex items-center gap-2 text-orange-500">
            <i class="pi pi-box text-3xl"></i>
            <span class="text-2xl font-bold tracking-tight text-gray-900">Delivest</span>
          </div>
          <p class="max-w-xs text-base text-gray-500 leading-relaxed">
            Лучшая еда из местных ресторанов с доставкой прямо к вашему порогу. Мы заботимся о том,
            чтобы ваш заказ приехал горячим.
          </p>
          <div class="flex gap-4">
            <Button icon="pi pi-telegram" severity="secondary" rounded text />
            <Button icon="pi pi-whatsapp" severity="secondary" rounded text />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 lg:col-span-2">
          <div class="space-y-6">
            <p class="text-lg font-bold text-gray-900">Меню</p>
            <ul class="space-y-4 text-gray-600">
              <li><a href="#" class="hover:text-orange-500 transition-colors">Все категории</a></li>
              <li>
                <a href="#" class="hover:text-orange-500 transition-colors">Акции и скидки</a>
              </li>
              <li>
                <a href="#" class="hover:text-orange-500 transition-colors">Популярные блюда</a>
              </li>
              <li><a href="#" class="hover:text-orange-500 transition-colors">Новинки</a></li>
            </ul>
          </div>
          <div class="space-y-6">
            <p class="text-lg font-bold text-gray-900">Компания</p>
            <ul class="space-y-4 text-gray-600">
              <li><a href="#" class="hover:text-orange-500 transition-colors">О нас</a></li>
              <li>
                <a href="#" class="hover:text-orange-500 transition-colors">Стать курьером</a>
              </li>
              <li>
                <a href="#" class="hover:text-orange-500 transition-colors">Для ресторанов</a>
              </li>
              <li><a href="#" class="hover:text-orange-500 transition-colors">Контакты</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mt-20 border-t border-gray-100 pt-10 text-center sm:text-left">
        <p class="text-sm text-gray-400">
          &copy; {{ currentYear }} Delivest. Сделано с любовью к еде.
          <span class="hidden sm:inline mx-2">|</span>
          <a href="#" class="hover:underline">Публичная оферта</a>
        </p>
      </div>
    </div>
  </footer>
</template>
