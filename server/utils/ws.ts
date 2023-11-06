import { WebSocketServer } from "ws";

declare global {
    var wss: WebSocketServer;
}

export function wsInit(server: any) {
    if (global.wss) {
        return;
    }

    console.log("initializing wss...");
    const wss = global.wss = new WebSocketServer({ server, path: "/ws" });
    console.log("initialized wss!");

    wss.on("error", console.error);

    wss.on("listening", () => {
        console.log("wss has started listening...");
    });

    wss.on("close", () => {
        console.log("wss server has closed");
    });

    wss.on("connection", socket => {
        console.log(`new connection!`);

        socket.send("connected");
        socket.on("message", data => {
            console.log(`received message: ${data.toString()}`);
            socket.send("ack");
        });
        socket.on("close", () => {
            console.log(`lost a connection!`);
        })
    });
}
