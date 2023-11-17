import { v4 as uuid } from "uuid";
import { Server as SocketIoServer, Socket as SocketIoClient } from "socket.io";

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
    logout: (ack: () => void) => void;

    enterMatchmaking: (team: Pokemon[], ack: (err?: "must_login" | "invalid_team") => void) => void;
    exitMatchmaking: (ack: () => void) => void;

    joinRoom: (room: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
    leaveRoom: (room: string, ack: (resp?: "bad_room" | "must_login") => void) => void;
    choose: (room: string, choice: Choice, turn: number, ack: (err?: ChoiceError) => void) => void;
    cancel: (room: string, turn: number, ack: (err?: ChoiceError) => void) => void;
}

export interface ServerMessage {
    foundMatch: (room: string) => void;

    nextTurn: (room: string, turn: Turn, choices?: Player["choices"]) => void;

    userJoin: (room: string, name: string, id: string, isSpectator: boolean) => void;
    userLeave: (room: string, id: string) => void;
    userDisconnect: (room: string, id: string) => void;
}

declare module "socket.io" {
    interface Socket {
        account?: Account;
    }
}

type Socket = SocketIoClient<ClientMessage, ServerMessage>;

type Room = {
    id: string;
    battle: Battle;
    turns: Turn[];
    accounts: Set<Account>;
};

class Account {
    id: string;
    name: string;
    battles: Set<Room>;
    rooms: Set<Room>;
    sockets: Set<Socket>;

    constructor(name: string) {
        this.id = uuid();
        this.name = name;
        this.battles = new Set();
        this.sockets = new Set();
        this.rooms = new Set();
    }

    joinBattle(room: Room) {
        this.joinRoom(room);
        this.battles.add(room);

        for (const socket of this.sockets) {
            socket.emit("foundMatch", room.id);
        }
    }

    joinRoom(room: Room, server?: GameServer) {
        if (this.rooms.has(room)) {
            return;
        }

        if (server) {
            server
                .to(room.id)
                .emit("userJoin", room.id, this.name, this.id, !this.battles.has(room));
        }
        room.accounts.add(this);
        this.rooms.add(room);

        for (const socket of this.sockets) {
            socket.join(room.id);
        }
    }

    leaveRoom(room: Room, forfeit: boolean, server: GameServer) {
        if (this.battles.has(room)) {
            if (!forfeit) {
                // TODO: start room disconnect timer
                server.to(room.id).emit("userDisconnect", room.id, this.id);
                return;
            }

            // TODO: forfeit
            this.battles.delete(room);
        }

        room.accounts.delete(this);
        this.rooms.delete(room);
        for (const socket of this.sockets) {
            socket.leave(room.id);
        }

        server.to(room.id).emit("userLeave", room.id, this.id);
    }

    addSocket(socket: Socket) {
        this.sockets.add(socket);
        socket.account = this;
        for (const room of this.rooms) {
            socket.join(room.id);
        }
    }

    removeSocket(socket: Socket, server: GameServer) {
        this.sockets.delete(socket);
        delete socket.account;
        if (!this.sockets.size) {
            for (const room of [...this.rooms]) {
                this.leaveRoom(room, false, server);
            }
        }
    }

    nextTurn(room: Room, turn: Turn) {
        const player = room.battle.players.find(pl => pl.id === this.id);
        const events = GameServer.censorEvents(turn.events, player);
        for (const socket of this.sockets) {
            socket.emit("nextTurn", room.id, { turn: turn.turn, events }, player?.choices);
        }
    }
}

class GameServer extends SocketIoServer<ClientMessage, ServerMessage> {
    /** Name -> Account */
    private accounts: Record<string, Account> = {};
    private rooms: Record<string, Room> = {};
    private mmWaiting: [Player, Account] | null = null;

    constructor(server: any) {
        super(server);
        this.on("connection", socket => this.newConnection(socket));
        this.on("error", console.error);
        this.on("close", () => console.log("game server has closed..."));
    }

    private newConnection(socket: Socket) {
        console.log(`new connection: ${socket.id}`);

        const ANON_SPECTATE = "spectate/";
        const { accounts, rooms } = this;
        socket.on("login", (name, ack) => {
            if (name.length < 3) {
                return ack("bad_username");
            }

            if (socket.account?.name !== name) {
                this.logout(socket);
            }

            const account = (accounts[name] ??= new Account(name));
            for (const roomId of [...socket.rooms]) {
                if (roomId.startsWith(ANON_SPECTATE)) {
                    socket.leave(roomId);
                    account.joinRoom(rooms[roomId.slice(ANON_SPECTATE.length)], this);
                }
            }

            account.addSocket(socket);
            return ack({ id: account.id, rooms: [...account.battles].map(room => room.id) });
        });
        socket.on("logout", ack => {
            this.logout(socket);
            ack();
        });
        socket.on("enterMatchmaking", (_team, ack) => {
            const account = socket.account;
            if (!account) {
                return ack("must_login");
            }

            ack();
            if (this.mmWaiting?.[1] === account) {
                return;
            }

            this.enterMatchmaking(account, new Player(account.id, this.createRandomTeam()));
        });
        socket.on("exitMatchmaking", ack => {
            if (socket.account === this.mmWaiting?.[1]) {
                this.mmWaiting = null;
            }

            ack();
        });
        socket.on("joinRoom", (roomId, ack) => {
            const room = rooms[roomId];
            if (!room) {
                return ack("bad_room");
            }

            const account = socket.account;
            const player = account
                ? room.battle.players.find(pl => pl.id === account.id)
                : undefined;
            if (account) {
                account.joinRoom(room, this);
            } else {
                socket.join([roomId, `${ANON_SPECTATE}${roomId}`]);
            }

            // FIXME: this team needs to be the one at the start of the battle
            return ack({
                team: player?.team,
                choices: player?.choices,
                players: [...room.accounts].map(account => ({
                    name: account.name,
                    id: account.id,
                    isSpectator: !account.battles.has(room),
                })),
                turns: room.turns.map(({ turn, events }) => ({
                    turn,
                    events: GameServer.censorEvents(events, player),
                })),
            });
        });
        socket.on("leaveRoom", (roomId, ack) => {
            const room = rooms[roomId];
            if (!room) {
                return ack("bad_room");
            }

            if (!socket.account) {
                return ack("must_login");
            }

            socket.account.leaveRoom(room, true, this);
        });
        socket.on("choose", (roomId, choice, turnId, ack) => {
            const info = this.validatePlayer(socket, roomId);
            if (typeof info === "string") {
                return ack(info);
            }

            const [player, room] = info;
            try {
                const turn = room.battle.choose(player, choice, turnId);
                ack();
                if (!turn) {
                    return;
                }

                room.turns.push(turn);
                for (const account of room.accounts) {
                    account.nextTurn(room, turn);
                }

                this.to(`${ANON_SPECTATE}${roomId}`).emit("nextTurn", roomId, {
                    turn: turn.turn,
                    events: GameServer.censorEvents(turn.events),
                });
            } catch (err) {
                if (err instanceof SelectionError) {
                    return ack(err.type);
                }
                throw err;
            }
        });
        socket.on("cancel", (roomId, turn, ack) => {
            const info = this.validatePlayer(socket, roomId);
            if (typeof info === "string") {
                return ack(info);
            }

            const [player, room] = info;
            try {
                room.battle.cancel(player, turn);
            } catch (err) {
                if (err instanceof SelectionError) {
                    return ack(err.type);
                }
                throw err;
            }
            ack();
        });
        socket.on("getRooms", ack => ack(Object.keys(rooms)));
        socket.on("disconnect", () => this.logout(socket));
    }

    private logout(socket: Socket) {
        const account = socket.account;
        if (account) {
            account.removeSocket(socket, this);
            if (!account.sockets.size && this.mmWaiting?.[1] === account) {
                this.mmWaiting = null;
            }
        }
    }

    private enterMatchmaking(account: Account, player: Player) {
        // highly advanced matchmaking algorithm
        if (this.mmWaiting) {
            const roomId = uuid();
            const [opponent, opponentAcc] = this.mmWaiting;
            const [battle, turn0] = Battle.start(player, opponent);
            this.rooms[roomId] = { id: roomId, battle, turns: [turn0], accounts: new Set() };

            account.joinBattle(this.rooms[roomId]);
            opponentAcc.joinBattle(this.rooms[roomId]);

            this.mmWaiting = null;
        } else {
            this.mmWaiting = [player, account];
        }
    }

    private validatePlayer(socket: Socket, roomId: string) {
        const room = this.rooms[roomId];
        if (!room) {
            return "bad_room";
        }

        const account = socket.account;
        if (!account || !account.battles.has(room)) {
            return "not_in_battle";
        }

        const player = room.battle.players.find(pl => pl.id === account.id);
        if (!player) {
            return "not_in_battle";
        }

        return [player, room] as [Player, Room];
    }

    private createRandomTeam() {
        const getMovePool = () => {
            const movePool = Object.keys(moveList) as MoveId[];
            const bad: MoveId[] = ["payday", "absorb", "focusenergy"];
            for (const move of bad) {
                movePool.splice(movePool.indexOf(move), 1);
            }
            return movePool;
        };

        const pool: MoveId[] = [];
        const randomMoves = (moves: MoveId[] = [], count: number = 4) => {
            while (moves.length < count) {
                if (!pool.length) {
                    pool.push(...getMovePool());
                }

                let move;
                do {
                    move = randChoice(pool);
                } while (
                    moves.includes(move) ||
                    move === "struggle" ||
                    moveList[move] instanceof AlwaysFailMove
                );

                pool.splice(pool.indexOf(move), 1);
                moves.push(move);
            }
            return moves;
        };

        const team = [
            new Pokemon(
                "alakazam",
                {},
                {},
                100,
                randomMoves(["psychic", "recover", "seismictoss", "thunderwave"])
            ),
            new Pokemon(
                "tauros",
                {},
                {},
                100,
                randomMoves(["bodyslam", "hyperbeam", "blizzard", "earthquake"])
            ),
            new Pokemon(
                "snorlax",
                {},
                {},
                100,
                randomMoves(["bodyslam", "reflect", "rest", "selfdestruct"])
            ),
            new Pokemon(
                "zapdos",
                {},
                {},
                100,
                randomMoves(["thunderbolt", "drillpeck", "thunderwave", "agility"])
            ),
            new Pokemon(
                "starmie",
                {},
                {},
                100,
                randomMoves(["recover", "blizzard", "thunderbolt", "psychic"])
            ),
            new Pokemon(
                "rhydon",
                {},
                {},
                100,
                randomMoves(["earthquake", "rockslide", "bodyslam", "substitute"])
            ),
        ];
        const num = randRangeInclusive(1, team.length - 1);
        const tmp = team[0];
        team[0] = team[num];
        team[num] = tmp;
        return team;
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

declare global {
    var server: GameServer;
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
