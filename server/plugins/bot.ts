import { startBot } from "../bot";

export default defineNitroPlugin(_ => {
  if (import.meta.dev) {
    startBot("randoms");
    startBot("randoms_nfe");
  }
});
