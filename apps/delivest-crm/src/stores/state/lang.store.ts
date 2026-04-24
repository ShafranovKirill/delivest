import { defineStore } from "pinia";
import { ref } from "vue";
import i18n from "@/i18n";

type LocaleType = "ru" | "en";

export const useLangStore = defineStore(
  "lang",
  () => {
    const currentLocale = ref<LocaleType>(i18n.global.locale.value as LocaleType);

    const setLocale = (locale: LocaleType) => {
      currentLocale.value = locale;
      i18n.global.locale.value = locale;

      document.querySelector("html")?.setAttribute("lang", locale);
    };

    const toggleLocale = () => {
      const newLocale: LocaleType = currentLocale.value === "ru" ? "en" : "ru";
      setLocale(newLocale);
    };

    return {
      currentLocale,
      setLocale,
      toggleLocale,
    };
  },
  {
    persist: true,
  },
);
