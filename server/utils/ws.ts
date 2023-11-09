import { WebSocket, WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";

import { Lobby } from "../../game/lobby";
import { ClientMessage, ServerMessage, wsStringify } from "../../utils/wsMessage";
import { Pokemon } from "../../game/pokemon";

declare global {
    var wss: WebSocketServer;
}

declare module "ws" {
    interface WebSocket {
        uuid: string;
    }
}

type Players = Record<string, { socket: WebSocket; name: string; isSpectator: boolean }>;

const initLobby = (players: Players) => {
    const lobby = new Lobby();
    lobby.on("join", (id, name, isSpectator) => {
        for (const { socket } of Object.values(players)) {
            socket.send(wsStringify<ServerMessage>({ type: "sv_join", id, name, isSpectator }));
        }
    });

    lobby.on("turn", (id, turn, events, choices) => {
        players[id].socket.send(
            wsStringify<ServerMessage>({ type: "sv_turn", turn, events, choices })
        );
    });

    lobby.on("leave", id => {
        for (const { socket } of Object.values(players)) {
            socket.send(wsStringify<ServerMessage>({ type: "sv_leave", id }));
        }
    });

    return lobby;
};

const initSocket = (socket: WebSocket, players: Players, lobby: Lobby) => {
    socket.uuid = uuid();
    socket.on("message", data => {
        const resp = JSON.parse(data.toString()) as ClientMessage;
        // TODO: validate the json

        const isRegistered = socket.uuid in players;
        if (!isRegistered && resp.type === "cl_join") {
            const team = lobby.join(socket.uuid, resp.name, [
                new Pokemon(
                    "mewtwo",
                    {},
                    {},
                    100,
                    ["hijumpkick", "doubleedge", "substitute", "explosion"],
                    "Mewtwo_" + socket.uuid.slice(0, 2)
                ),
            ]);
            players[socket.uuid] = {
                socket,
                name: resp.name,
                isSpectator: team === undefined,
            };

            // TODO: send the current state of the game if the player is joining mid-battle
            socket.send(
                wsStringify<ServerMessage>({
                    type: "sv_accepted",
                    id: socket.uuid,
                    team,
                    players: Object.keys(players).map(id => ({
                        id,
                        name: players[id].name,
                        isSpectator: players[id].isSpectator,
                    })),
                })
            );

            if (!lobby.isPlaying()) {
                lobby.startBattle();
            }
        } else if (isRegistered && resp.type === "cl_choice") {
            socket.send(
                wsStringify<ServerMessage>({
                    type: "sv_choice",
                    error: lobby.chooseFor(socket.uuid, resp.choice),
                })
            );
        } else if (isRegistered && resp.type === "cl_cancel") {
            socket.send(
                wsStringify<ServerMessage>({
                    type: "sv_cancel",
                    error: lobby.cancelFor(socket.uuid, resp.turn),
                })
            );
        } else {
            // TODO: invalid request
        }
    });

    socket.on("close", () => {
        if (socket.uuid in players) {
            delete players[socket.uuid];
            lobby.leave(socket.uuid);
        }
    });
};

export function wsInit(server: any, reset: boolean) {
    if (global.wss) {
        if (reset) {
            global.wss.close();
        } else {
            return;
        }
    }

    console.log("initializing wss...");

    const wss = (global.wss = new WebSocketServer({ server, path: "/ws" }));
    const players: Players = {};
    const lobby = initLobby(players);

    wss.on("connection", socket => initSocket(socket as WebSocket, players, lobby));
    wss.on("error", console.error);
    wss.on("listening", () => console.log("wss has started listening..."));
    wss.on("close", () => console.log("wss server has closed"));

    console.log("initialized wss!");
}
