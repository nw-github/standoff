import { io, type Socket } from "socket.io-client";
import type { ServerMessage, ClientMessage } from "../server/utils/gameMessage";

export default defineNuxtPlugin(_ => ({
    provide: {
        conn: io() as Socket<ServerMessage, ClientMessage>,
    },
}));
