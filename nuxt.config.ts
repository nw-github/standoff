// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    devtools: { enabled: true },
    plugins: ["~/plugins/socket.ts"],
    compatibilityDate: "2025-02-08",
    nitro: {
        experimental: {
            websocket: true,
        },
    },
});
