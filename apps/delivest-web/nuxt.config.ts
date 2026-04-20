export default defineNuxtConfig({
  devServer: {
    port: 4200,
  },
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "@pinia/nuxt", "@primevue/nuxt-module"],
  future: {
    compatibilityVersion: 4,
  },
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
  },
  primevue: {
    options: {
      ripple: true,
    },
    importTheme: { from: "@primevue/themes/aura" },
  },
});
