import { v4 as uuid } from "uuid";
import { Server, Socket } from "socket.io";

import { Pokemon } from "../../game/pokemon";
import { MoveId, moveList } from "../../game/moveList";
import { hpPercent, randChoice, randRangeInclusive } from "../../game/utils";
import { AlwaysFailMove } from "../../game/moves";
import { Battle, Player, SelectionError, Turn, Choice } from "../../game/battle";
import { BattleEvent } from "../../game/events";

export type LoginResponse = {
    id: string;
    rooms: string[];
};

export type JoinRoomResponse = {
    team?: Pokemon[];
    choices?: Player["choices"];
    players: { id: string; name: string; isSpectator: boolean }[];
    turns: Turn[];
};

export type ChoiceError = SelectionError["type"] | "bad_room" | "not_in_battle";

export interface ClientMessage {
    getRooms: (ack: (rooms: string[]) => void) => void;
    login: (name: string, ack: (resp: LoginResponse | "bad_username") => void) => void;
    enterMatchmaking: (team: Pokemon[], ack: (err?: "must_login" | "invalid_team") => void) => void;
    exitMatchmaking: (ack: () => void) => void;
    joinRoom: (room: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
    choose: (room: string, choice: Choice, turn: number, ack: (err?: ChoiceError) => void) => void;
    cancel: (room: string, turn: number, ack: (err?: ChoiceError) => void) => void;
}

export interface ServerMessage {
    foundMatch: (roomId: string) => void;
    nextTurn: (roomId: string, turn: Turn, choices?: Player["choices"]) => void;
}

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
    sockets: Set<string>;
};

type Room = {
    battle: Battle;
    turns: Turn[];
    accounts: Set<Account>;
};

class GameServer {
    private readonly server: Server<ClientMessage, ServerMessage>;
    /** Socket Id -> Account */
    private conns: Record<string, Account> = {};
    /** Name -> Account */
    private accounts: Record<string, Account> = {};
    /** Room Id -> Room */
    private rooms: Record<string, Room> = {};
    private mmWaiting: [Player, Account] | null = null;

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
                accounts[name] = { battles: new Set(), name, id: uuid(), sockets: new Set() };
            }

            const account = accounts[name];
            account.sockets.add(socket.id);
            conns[socket.id] = account;

            for (const room of [...socket.rooms]) {
                if (room in rooms) {
                    socket.leave(room);
                    rooms[room].accounts.add(account);
                }
            }

            return ack({ id: account.id, rooms: [...account.battles] });
        });
        socket.on("enterMatchmaking", (_team, ack) => {
            const account = conns[socket.id];
            if (!account) {
                return ack("must_login");
            }

            ack();
            if (this.mmWaiting?.[1] === account) {
                return;
            }

            const team = [
                new Pokemon("alakazam", {}, {}, 100,["psychic", "recover", "seismictoss", "thunderwave"]),
                new Pokemon("tauros", {}, {}, 100,  ["bodyslam", "hyperbeam", "blizzard", "earthquake"]),
                new Pokemon("snorlax", {}, {}, 100, ["bodyslam", "reflect", "rest", "selfdestruct"]),
                new Pokemon("zapdos", {}, {}, 100,  ["thunderbolt", "drillpeck", "thunderwave", "agility"]),
                new Pokemon("starmie", {}, {}, 100, ["recover", "blizzard", "thunderbolt", "psychic"]),
                new Pokemon("rhydon", {}, {}, 100,  ["earthquake", "rockslide", "bodyslam", "substitute"]),
            ];
            const num = randRangeInclusive(1, team.length - 1);
            const tmp = team[0];
            team[0] = team[num];
            team[num] = tmp;
            this.enterMatchmaking(socket, new Player(account.id, team));
        });
        socket.on("exitMatchmaking", ack => {
            if (conns[socket.id] === this.mmWaiting?.[1]) {
                this.mmWaiting = null;
            }

            ack();
        });
        socket.on("joinRoom", async (roomId, ack) => {
            const room = rooms[roomId];
            if (!room) {
                return ack("bad_room");
            }

            const account = conns[socket.id];
            const player = account
                ? room.battle.players.find(pl => pl.id === account.id)
                : undefined;
            if (account) {
                room.accounts.add(account);
            } else {
                socket.join(roomId);
            }
            // TODO: broadcast join message

            // FIXME: this team needs to be the one at the start of the battle
            return ack({
                team: player?.team,
                choices: player?.choices,
                players: [...room.accounts].map(account => ({
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
        socket.on("choose", (roomId, choice, turnId, ack) => {
            const info = this.validatePlayer(socket, roomId);
            if (typeof info === "string") {
                return ack(info);
            }

            try {
                const [player, room] = info;
                const turn = room.battle.choose(player, choice, turnId);
                ack();
                if (!turn) {
                    return;
                }

                room.turns.push(turn);
                for (const account of room.accounts) {
                    const player = room.battle.players.find(pl => pl.id === account.id);
                    const events = GameServer.censorEvents(turn.events, player);
                    for (const socket of account.sockets) {
                        this.server
                            .to(socket)
                            .emit("nextTurn", roomId, { turn: turn.turn, events }, player?.choices);
                    }
                }

                this.server
                    .to(roomId)
                    .emit("nextTurn", roomId, {
                        turn: turn.turn,
                        events: GameServer.censorEvents(turn.events),
                    });
            } catch (err) {
                if (err instanceof SelectionError) {
                    return ack(err.type);
                }
            }
        });
        socket.on("cancel", (roomId, turn, ack) => {
            const info = this.validatePlayer(socket, roomId);
            if (typeof info === "string") {
                return ack(info);
            }

            const [player, room] = info;
            room.battle.cancel(player, turn);
            ack();
        });
        socket.on("getRooms", ack => ack(Object.keys(rooms)));
        socket.on("disconnect", () => {
            // TODO: start room disconnect timer
            const account = conns[socket.id];
            if (account) {
                account.sockets.delete(socket.id);
                if (!account.sockets.size && this.mmWaiting?.[1] === account) {
                    this.mmWaiting = null;
                }
            }

            delete conns[socket.id];
        });
    }

    enterMatchmaking(socket: ClientSocket, player: Player) {
        // highly advanced matchmaking algorithm
        const { rooms, conns } = this;
        if (this.mmWaiting) {
            const [opponent, opponentAcc] = this.mmWaiting;
            const roomId = uuid();
            const [battle, turn0] = Battle.start(player, opponent);
            rooms[roomId] = { battle, turns: [turn0], accounts: new Set() };

            for (const id of [socket.id, ...opponentAcc.sockets]) {
                const account = conns[id];
                account.battles.add(roomId);
                rooms[roomId].accounts.add(account);
                this.server.to(id).emit("foundMatch", roomId);
            }
            this.mmWaiting = null;
        } else {
            this.mmWaiting = [player, conns[socket.id]];
        }
    }

    validatePlayer(socket: ClientSocket, roomId: string) {
        const room = this.rooms[roomId];
        if (!room) {
            return "bad_room";
        }

        const account = this.conns[socket.id];
        if (!account || !account.battles.has(roomId)) {
            return "not_in_battle";
        }

        const player = room.battle.players.find(pl => pl.id === account.id);
        if (!player) {
            return "not_in_battle";
        }

        return [player, room] as [Player, Room];
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
