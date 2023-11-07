import { defineNuxtModule } from "nuxt/kit";
import { wsInit } from "../server/utils/ws";

export default defineNuxtModule((_options, nuxt) => {
    nuxt.hook("listen", server => wsInit(server, true));
});
