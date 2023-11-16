import { v4 as uuid } from "uuid";
import { Server, Socket } from "socket.io";

import { ClientMessage, ServerMessage } from "./gameMessage";
import { Pokemon } from "../../game/pokemon";
import { MoveId, moveList } from "../../game/moveList";
import { hpPercent, randChoice, randRangeInclusive } from "../../game/utils";
import { AlwaysFailMove } from "../../game/moves";
import { Battle, Player, Turn } from "../../game/battle";
import { BattleEvent } from "../../game/events";

declare global {
    var server: GameServer;
}

const keys = Object.keys(moveList) as MoveId[];

const randomMoves = (moves: MoveId[] = [], count: number = 4) => {
    while (moves.length < count) {
        let move;
        do {
            move = randChoice(keys);
        } while (
            moves.includes(move) ||
            move === "struggle" ||
            moveList[move] instanceof AlwaysFailMove
        );
        moves.push(move);
    }
    return moves;
};

//         if (isRegistered && resp.type === "cl_choice") {
//             socket.send(
//                 wsStringify<ServerMessage>({
//                     type: "sv_choice",
//                     error: lobby.chooseFor(socket.id, resp.choice),
//                 })
//             );
//         } else if (isRegistered && resp.type === "cl_cancel") {
//             socket.send(
//                 wsStringify<ServerMessage>({
//                     type: "sv_cancel",
//                     error: lobby.cancelFor(socket.id, resp.turn),
//                 })
//             );
//         }

type ClientSocket = Socket<ClientMessage, ServerMessage>;

type Account = {
    id: string;
    battles: Set<string>;
    name: string;
};

type Room = {
    battle: Battle;
    turns: Turn[];
    accounts: Account[];
};

class GameServer {
    private readonly server: Server<ClientMessage, ServerMessage>;
    /** Socket Id -> Account */
    private conns: Record<string, Account> = {};
    /** Name -> Account */
    private accounts: Record<string, Account> = {};
    /** Room Id -> Room */
    private rooms: Record<string, Room> = {};
    private mmWaiting: [Player, ClientSocket] | null = null;

    constructor(server: any) {
        this.server = new Server<ClientMessage, ServerMessage>(server);
        this.server.on("connection", socket => this.newConnection(socket));
        this.server.on("error", console.error);
        this.server.on("listening", () => console.log("wss has started listening..."));
        this.server.on("close", () => console.log("wss server has closed"));
    }

    close() {
        this.server.close();
    }

    private newConnection(socket: ClientSocket) {
        console.log(`new connection: ${socket.id}`);

        const { conns, accounts, rooms } = this;
        socket.on("login", (name, ack) => {
            if (name.length < 3) {
                return ack("bad_username");
            }

            if (!(name in accounts)) {
                accounts[name] = { battles: new Set(), name, id: uuid() };
            }

            const account = accounts[name];
            conns[socket.id] = account;
            return ack({ id: account.id, rooms: [...account.battles] });
        });
        socket.on("enterMatchmaking", (_team, ack) => {
            const account = conns[socket.id];
            if (!account) {
                return ack("must_login");
            }

            ack();
            const team = [
                new Pokemon("alakazam", {}, {}, 100, randomMoves(["rest"])),
                new Pokemon("tauros", {}, {}, 100, randomMoves(["swordsdance"])),
                new Pokemon("snorlax", {}, {}, 100, randomMoves(["bodyslam"])),
                new Pokemon("zapdos", {}, {}, 100, randomMoves(["thunder"])),
                new Pokemon("starmie", {}, {}, 100, randomMoves(["crabhammer"])),
                new Pokemon("rhydon", {}, {}, 100, randomMoves(["earthquake"])),
            ];
            const num = randRangeInclusive(1, team.length - 1);
            const tmp = team[0];
            team[0] = team[num];
            team[num] = tmp;
            this.enterMatchmaking(socket, new Player(account.id, team));
        });
        socket.on("joinRoom", async (roomId, ack) => {
            const room = rooms[roomId];
            if (!room) {
                return ack("bad_room");
            }

            const account = conns[socket.id];
            socket.join(!account || !account.battles.has(roomId) ? `spectate/${roomId}` : roomId);

            const player = account
                ? room.battle.players.find(pl => pl.id === account.id)
                : undefined;
            // FIXME: this team needs to be the one at the start of the battle
            return ack({
                team: player?.team,
                choices: player?.choices,
                players: room.accounts.map(account => ({
                    name: account.name,
                    id: account.id,
                    isSpectator: !account.battles.has(roomId),
                })),
                turns: room.turns.map(({ turn, events }) => ({
                    turn,
                    events: GameServer.censorEvents(events, player),
                })),
            });
        });
        socket.on("disconnect", () => {
            // TODO: start room disconnect timer
            delete conns[socket.id];
            if (this.mmWaiting?.[1] === socket) {
                this.mmWaiting = null;
            }
        });
    }

    enterMatchmaking(socket: ClientSocket, player: Player) {
        // highly advanced matchmaking algorithm
        const { rooms, conns } = this;
        if (this.mmWaiting) {
            const [opponent, opponentSocket] = this.mmWaiting;
            const roomId = uuid();
            const [battle, turn0] = Battle.start(player, opponent);
            rooms[roomId] = { battle, turns: [turn0], accounts: [] };

            for (const s of [socket, opponentSocket]) {
                const account = conns[s.id];
                account.battles.add(roomId);
                rooms[roomId].accounts.push(account);
                s.emit("foundMatch", roomId);
            }
        } else {
            this.mmWaiting = [player, socket];
        }
    }

    static censorEvents(events: BattleEvent[], player?: Player) {
        const result = [...events];
        for (let i = 0; i < result.length; i++) {
            const e = result[i];
            if (e.type === "damage" && e.target !== player?.id) {
                result[i] = {
                    ...e,
                    hpBefore: hpPercent(e.hpBefore, e.maxHp),
                    hpAfter: hpPercent(e.hpAfter, e.maxHp),
                    maxHp: 100,
                };
            } else if (e.type === "switch" && e.src !== player?.id) {
                result[i] = {
                    ...e,
                    hp: hpPercent(e.hp, e.maxHp),
                    maxHp: 100,
                };
            } else if ((e.type === "stages" || e.type === "status") && e.id !== player?.id) {
                // FIXME: this might not be accurate if two status moves were used in the same turn.
                result[i] = {
                    ...e,
                    stats: player ? { ...player.active.stats } : { atk: 0, def: 0, spc: 0, spe: 0 },
                };
            }
        }

        return result;
    }
}

export function gameServerInit(server: any, reset: boolean) {
    if (global.server) {
        if (reset) {
            console.log("resetting game server...");
            global.server.close();
        } else {
            return;
        }
    }

    console.log("initializing game server...");
    global.server = new GameServer(server);
    console.log("initialized game server!");
}
