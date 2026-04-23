import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { MyPreset } from "./theme";
import router from "./router";
import "./style.css";
import "primeicons/primeicons.css";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

import dayjs from "dayjs";
import "dayjs/locale/ru";
import relativeTime from "dayjs/plugin/relativeTime";
import i18n from "./i18n";
import ToastService from "primevue/toastservice";

dayjs.locale("ru");
dayjs.extend(relativeTime);

const app = createApp(App);
app.use(ToastService);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

app.use(router);
app.use(i18n);
app.use(PrimeVue, {
  theme: {
    preset: MyPreset,
    options: {
      darkModeSelector: "system",
    },
  },
});
app.use(pinia);
app.mount("#app");
