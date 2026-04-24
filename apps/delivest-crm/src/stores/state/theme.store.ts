import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useThemeStore = defineStore(
  "theme",
  () => {
    const isDark = ref(false);

    const updateDOM = (dark: boolean) => {
      const element = document.documentElement;
      if (dark) {
        element.classList.add("p-dark");
      } else {
        element.classList.remove("p-dark");
      }
    };

    const toggleTheme = () => {
      isDark.value = !isDark.value;
      updateDOM(isDark.value);
    };

    watch(
      isDark,
      val => {
        updateDOM(val);
      },
      { immediate: true },
    );

    return { isDark, toggleTheme };
  },
  {
    persist: true,
  },
);
