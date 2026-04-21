import { createI18n } from "vue-i18n";

const i18n = createI18n({
  legacy: false,
  locale: "ru",
  fallbackLocale: "en",
  messages: {
    ru: {
      dashboard: "Панель управления",
      orders: "Заказы",
      settings: "Настройки",
    },
    en: {
      dashboard: "Dashboard",
      orders: "Orders",
      settings: "Settings",
    },
  },
});

export default i18n;
