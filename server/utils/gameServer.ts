import { v4 as uuid } from "uuid";
import { Server as SocketIoServer, Socket as SocketIoClient } from "socket.io";

import { Pokemon } from "../../game/pokemon";
import { hpPercent } from "../../game/utils";
import { Battle, Options, Player, Turn } from "../../game/battle";
import { BattleEvent } from "../../game/events";
import { type FormatId, type TeamProblems, formatDescs } from "../../utils/formats";

export type LoginResponse = {
  id: string;
};

export type JoinRoomResponse = {
  team?: Pokemon[];
  options?: Options;
  players: { id: string; name: string; isSpectator: boolean; nPokemon: number }[];
  turns: Turn[];
  chats: Chats;
  format: FormatId;
};

export type ChoiceError = "invalid_choice" | "bad_room" | "not_in_battle" | "too_late";

export type Chats = Record<number, { player: string; message: string }[]>;

export type RoomDescriptor = {
  id: string;
  /** Name[], not Id[] */
  players: string[];
  format: FormatId;
};

export interface ClientMessage {
  getRooms: (ack: (rooms: RoomDescriptor[]) => void) => void;

  login: (name: string, ack: (resp: LoginResponse | "bad_username") => void) => void;
  logout: (ack: () => void) => void;

  enterMatchmaking: (
    team: string | undefined,
    format: FormatId,
    ack: (err?: "must_login" | "invalid_team", problems?: TeamProblems) => void
  ) => void;
  exitMatchmaking: (ack: () => void) => void;

  joinRoom: (room: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
  leaveRoom: (room: string, ack: (resp?: "bad_room" | "must_login") => void) => void;
  choose: (
    room: string,
    idx: number,
    type: "move" | "switch" | "forfeit",
    turn: number,
    ack: (err?: ChoiceError) => void
  ) => void;
  cancel: (room: string, turn: number, ack: (err?: ChoiceError) => void) => void;
  chat: (
    room: string,
    message: string,
    ack: (resp?: "bad_room" | "not_in_room" | "bad_message") => void
  ) => void;
}

export interface ServerMessage {
  foundMatch: (room: string) => void;

  nextTurn: (room: string, turn: Turn, options?: Options) => void;

  userJoin: (
    room: string,
    name: string,
    id: string,
    isSpectator: boolean,
    nPokemon: number
  ) => void;
  userLeave: (room: string, id: string) => void;
  userDisconnect: (room: string, id: string) => void;
  userChat: (room: string, id: string, message: string, turn: number) => void;
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
  format: FormatId;
  chats: Chats;
};

class Account {
  name: string;
  id = uuid();
  battles = new Set<Room>();
  rooms = new Set<Room>();
  sockets = new Set<Socket>();
  matchmaking?: FormatId;

  constructor(name: string) {
    this.name = name;
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
      const player = room.battle.findPlayer(this.id);
      server
        .to(room.id)
        .emit("userJoin", room.id, this.name, this.id, !player, player?.team.length ?? 0);
    }
    room.accounts.add(this);
    this.rooms.add(room);

    for (const socket of this.sockets) {
      socket.join(room.id);
    }
  }

  leaveRoom(room: Room, server: GameServer) {
    if (this.battles.has(room)) {
      // TODO: start room disconnect timer
      server.to(room.id).emit("userDisconnect", room.id, this.id);
      return;
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
        this.leaveRoom(room, server);
      }
    }
  }

  nextTurn(room: Room, { events, switchTurn }: Turn) {
    const player = room.battle.findPlayer(this.id);
    const turn = { switchTurn, events: GameServer.censorEvents(events, player) };
    for (const socket of this.sockets) {
      socket.emit("nextTurn", room.id, turn, player?.options);
    }
  }
}

const ROOM_CLEANUP_DELAY_MS = 15 * 60 * 1000;
const ANON_SPECTATE = "spectate/";

export class GameServer extends SocketIoServer<ClientMessage, ServerMessage> {
  /** Name -> Account */
  private accounts: Record<string, Account> = {};
  private rooms: Record<string, Room> = {};
  private mmWaiting: Partial<Record<FormatId, [Player, Account]>> = {};
  private finishedRooms: [string, number][] = [];

  constructor(server?: any) {
    super(server);
    this.on("connection", socket => this.newConnection(socket));
    this.on("error", console.error);
    this.on("close", () => console.log("game server has closed..."));

    setInterval(() => {
      let index = -1;
      for (const [, finishedAt] of this.finishedRooms) {
        if (Date.now() - finishedAt < ROOM_CLEANUP_DELAY_MS) {
          break;
        }

        index++;
      }

      for (const [roomId] of this.finishedRooms.splice(0, index + 1)) {
        const room = this.rooms[roomId];
        for (const account of room.accounts) {
          account.leaveRoom(room, this);
        }
        delete this.rooms[roomId];
      }
    }, 1000 * 60);
  }

  private newConnection(socket: Socket) {
    console.log(`new connection: ${socket.id}`);

    socket.on("login", (name, ack) => {
      if (name.length < 3) {
        return ack("bad_username");
      }

      if (socket.account) {
        if (socket.account.name !== name) {
          this.logout(socket);
        } else {
          return ack({ id: socket.account.id });
        }
      }

      const account = (this.accounts[name] ??= new Account(name));
      for (const roomId of [...socket.rooms]) {
        if (roomId.startsWith(ANON_SPECTATE)) {
          socket.leave(roomId);
          account.joinRoom(this.rooms[roomId.slice(ANON_SPECTATE.length)], this);
        }
      }

      account.addSocket(socket);
      return ack({ id: account.id });
    });
    socket.on("logout", ack => {
      this.logout(socket);
      ack();
    });
    socket.on("enterMatchmaking", (team, format, ack) => {
      const account = socket.account;
      if (!account) {
        return ack("must_login");
      }

      if (account.matchmaking) {
        ack();
        this.leaveMatchmaking(account);
      } else {
        const problems = this.enterMatchmaking(account, format, team);
        if (problems) {
          ack("invalid_team", problems);
        } else {
          ack();
        }
      }
    });
    socket.on("exitMatchmaking", ack => {
      if (socket.account) {
        this.leaveMatchmaking(socket.account);
      }
      ack();
    });
    socket.on("joinRoom", (roomId, ack) => {
      const room = this.rooms[roomId];
      if (!room) {
        return ack("bad_room");
      }

      const account = socket.account;
      const player = account && room.battle.findPlayer(account.id);
      if (account) {
        account.joinRoom(room, this);
      } else {
        socket.join([roomId, `${ANON_SPECTATE}${roomId}`]);
      }

      // FIXME: this team needs to be the one at the start of the battle
      return ack({
        team: player?.team,
        options: player?.options,
        players: [...room.accounts].map(account => ({
          name: account.name,
          id: account.id,
          isSpectator: !account.battles.has(room),
          nPokemon: room.battle.findPlayer(account.id)?.team.length ?? 0,
        })),
        turns: room.turns.map(({ events, switchTurn }) => ({
          events: GameServer.censorEvents(events, player),
          switchTurn,
        })),
        chats: room.chats,
        format: room.format,
      });
    });
    socket.on("leaveRoom", (roomId, ack) => {
      const room = this.rooms[roomId];
      if (!room) {
        return ack("bad_room");
      }

      if (!socket.account) {
        return ack("must_login");
      }

      socket.account.leaveRoom(room, this);
    });
    socket.on("choose", (roomId, index, type, sequenceNo, ack) => {
      const info = this.validatePlayer(socket, roomId, sequenceNo);
      if (typeof info === "string") {
        return ack(info);
      }

      const [player, room] = info;
      if (type === "move") {
        if (!player.chooseMove(index)) {
          return ack("invalid_choice");
        }
      } else if (type === "switch") {
        if (!player.chooseSwitch(index)) {
          return ack("invalid_choice");
        }
      } else if (type !== "forfeit") {
        return ack("invalid_choice");
      }

      ack();
      const turn = type === "forfeit" ? room.battle.forfeit(player) : room.battle.nextTurn();
      if (!turn) {
        return;
      }

      if (room.battle.victor) {
        this.finishedRooms.push([roomId, Date.now()]);
      }

      room.turns.push(turn);
      for (const account of room.accounts) {
        account.nextTurn(room, turn);
      }

      this.to(`${ANON_SPECTATE}${roomId}`).emit("nextTurn", roomId, {
        switchTurn: turn.switchTurn,
        events: GameServer.censorEvents(turn.events),
      });
    });
    socket.on("cancel", (roomId, sequenceNo, ack) => {
      const info = this.validatePlayer(socket, roomId, sequenceNo);
      if (typeof info === "string") {
        return ack(info);
      }

      info[0].cancel();
      ack();
    });
    socket.on("chat", (roomId, message, ack) => {
      if (!message.trim().length) {
        return ack("bad_message");
      }

      const room = this.rooms[roomId];
      if (!room) {
        return ack("bad_room");
      }

      const account = socket.account;
      if (!account || !account.rooms.has(room)) {
        return ack("not_in_room");
      }

      ack();

      const turn = Math.max(room.turns.length - 1, 0);
      if (!room.chats[turn]) {
        room.chats[turn] = [];
      }

      room.chats[turn].push({ message, player: account.id });
      this.to(roomId).emit("userChat", roomId, account.id, message, turn);
    });
    socket.on("getRooms", ack =>
      ack(
        Object.entries(this.rooms)
          .filter(([, room]) => !room.battle.victor)
          .map(([id, room]) => ({
            id,
            players: [...room.accounts].filter(acc => acc.battles.has(room)).map(acc => acc.name),
            format: room.format,
          }))
      )
    );
    socket.on("disconnect", () => this.logout(socket));
  }

  private logout(socket: Socket) {
    const account = socket.account;
    if (account) {
      account.removeSocket(socket, this);
      if (!account.sockets.size) {
        this.leaveMatchmaking(account);
      }
    }
  }

  private enterMatchmaking(account: Account, format: FormatId, team?: string) {
    let player;
    if (formatDescs[format].validate) {
      if (!team) {
        return ["Must provide a team for this format"];
      }

      const [success, result] = formatDescs[format].validate(team);
      if (!success) {
        return result;
      }

      player = new Player(account.id, result);
    } else {
      player = new Player(account.id, formatDescs[format].generate!());
    }

    // highly advanced matchmaking algorithm
    const mm = this.mmWaiting[format];
    if (mm) {
      const roomId = uuid();
      const [opponent, opponentAcc] = mm;
      const [battle, turn0] = Battle.start(player, opponent);
      this.rooms[roomId] = {
        id: roomId,
        battle,
        turns: [turn0],
        accounts: new Set(),
        format,
        chats: {},
      };

      account.joinBattle(this.rooms[roomId]);
      opponentAcc.joinBattle(this.rooms[roomId]);

      this.leaveMatchmaking(account);
      this.leaveMatchmaking(opponentAcc);
    } else {
      this.mmWaiting[format] = [player, account];
      account.matchmaking = format;
    }
  }

  private leaveMatchmaking(account: Account) {
    const format = account.matchmaking;
    if (format && this.mmWaiting[format]?.[1] === account) {
      delete this.mmWaiting[format];
    }
    delete account.matchmaking;
  }

  private validatePlayer(socket: Socket, roomId: string, sequenceNo: number) {
    const room = this.rooms[roomId];
    if (!room) {
      return "bad_room";
    }

    const account = socket.account;
    if (!account || !account.battles.has(room)) {
      return "not_in_battle";
    }

    const player = room.battle.findPlayer(account.id);
    if (!player) {
      return "not_in_battle";
    }

    if (sequenceNo !== room.turns.length) {
      return "too_late";
    }

    return [player, room] as const;
  }

  static censorEvents(events: BattleEvent[], player?: Player) {
    const result = [...events];
    for (let i = 0; i < result.length; i++) {
      const e = result[i];
      if ((e.type === "damage" || e.type === "recover") && e.target !== player?.id) {
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
          indexInTeam: -1,
        };
      } else if ((e.type === "stages" || e.type === "status") && e.id !== player?.id) {
        // FIXME: this might not be accurate if two status moves were used in the same turn.
        result[i] = {
          ...e,
          stats: player ? { ...player.active.v.stats } : { atk: 0, def: 0, spc: 0, spe: 0 },
        };
      }
    }

    return result;
  }
}
