import { io, type Socket } from "socket.io-client";
import type { ServerMessage, ClientMessage } from "../server/utils/gameServer";

export default defineNuxtPlugin(_ => ({
    provide: {
        conn: io() as Socket<ServerMessage, ClientMessage>,
    },
}));
