import { defineNuxtModule } from "nuxt/kit";
import { gameServerInit } from "../server/utils/gameServer";

export default defineNuxtModule((_options, nuxt) => {
    nuxt.hook("listen", server => gameServerInit(server, true));
});
