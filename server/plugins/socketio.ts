import { Server as Engine } from "engine.io";
import { defineEventHandler } from "h3";
import { GameServer } from "../utils/gameServer";

export default defineNitroPlugin(nitro => {
    const engine = new Engine();
    const io = new GameServer();
    io.bind(engine);

    nitro.router.use(
        "/socket.io/",
        defineEventHandler({
            handler(event) {
                // @ts-ignore
                engine.handleRequest(event.node.req, event.node.res);
                event._handled = true;
            },
            websocket: {
                open(peer) {
                    // @ts-expect-error private method and property
                    const { nodeReq } = peer._internal;
                    // @ts-expect-error private method and property
                    engine.prepare(nodeReq);
                    // @ts-expect-error private method and property
                    engine.onWebSocket(nodeReq, nodeReq.socket, peer.websocket);
                },
            },
        })
    );

    console.log("initialized game server!");
});
