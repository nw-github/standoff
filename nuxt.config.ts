// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: "2025-02-08",
  modules: ["@nuxt/ui", "@nuxt/image"],
  nitro: {
    experimental: {
      websocket: true,
    },
  },
});