import { WebSocketServer } from "ws";

export function wsInit(server: any) {
    console.log("initializing global wss...");
    const wss = new WebSocketServer({ server, path: "/ws" });

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

    return wss;
}
