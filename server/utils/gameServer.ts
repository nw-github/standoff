import { v4 as uuid } from "uuid";
import { Server as SocketIoServer, Socket as SocketIoClient } from "socket.io";

import { Pokemon } from "../../game/pokemon";
import { hpPercent } from "../../game/utils";
import { Battle, Options, Player, Turn } from "../../game/battle";
import { BattleEvent } from "../../game/events";
import { type FormatId, type TeamProblems, formatDescs } from "../../utils/formats";
import { User } from "#auth-utils";

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
  timer?: BattleTimer;
};

export type BattleTimer = { startedAt: number; duration: number };

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

  enterMatchmaking: (
    team: string | undefined,
    format: FormatId,
    ack: (err?: "must_login" | "invalid_team", problems?: TeamProblems) => void,
  ) => void;
  exitMatchmaking: (ack: () => void) => void;

  joinRoom: (room: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
  leaveRoom: (room: string, ack: (resp?: "bad_room" | "must_login") => void) => void;
  choose: (
    room: string,
    idx: number,
    type: "move" | "switch" | "forfeit",
    turn: number,
    ack: (err?: ChoiceError) => void,
  ) => void;
  cancel: (room: string, turn: number, ack: (err?: ChoiceError) => void) => void;
  chat: (
    room: string,
    message: string,
    ack: (resp?: "bad_room" | "not_in_room" | "bad_message") => void,
  ) => void;
  startTimer: (
    room: string,
    ack: (resp?: "bad_room" | "not_in_room" | "not_in_battle" | "already_on") => void,
  ) => void;
}

export interface ServerMessage {
  foundMatch: (room: string) => void;

  nextTurn: (room: string, turn: Turn, options?: Options, timer?: BattleTimer) => void;
  timerStart: (room: string, who: string, timer: BattleTimer) => void;

  userJoin: (
    room: string,
    name: string,
    id: string,
    isSpectator: boolean,
    nPokemon: number,
  ) => void;
  userLeave: (room: string, id: string) => void;
  userChat: (room: string, id: string, message: string, turn: number) => void;
}

declare module "socket.io" {
  interface Socket {
    account?: Account;
  }
}

type Socket = SocketIoClient<ClientMessage, ServerMessage>;

const ROOM_CLEANUP_DELAY_MS = 15 * 60 * 1000;
const TURN_DECISION_TIME_MS = 45 * 1000;
const ANON_SPECTATE = "spectate:";

class Room {
  turns: Turn[];
  accounts = new Set<Account>();
  chats: Chats = [];
  timer?: NodeJS.Timeout;
  lastTurn: number = Date.now();

  constructor(
    public id: string,
    public battle: Battle,
    init: Turn,
    public format: FormatId,
    public server: GameServer,
  ) {
    this.turns = [init];
  }

  endTurn() {
    if (this.battle.victor) {
      clearInterval(this.timer);
      this.timer = undefined;
      setTimeout(() => {
        for (const account of this.accounts) {
          account.leaveRoom(this, this.server);
        }
        delete this.server.rooms[this.id];
      }, ROOM_CLEANUP_DELAY_MS);
      return;
    }

    this.lastTurn = Date.now();
  }

  startTimer(initiator: Account, server: GameServer) {
    if (this.timer || this.battle.victor) {
      return false;
    }

    this.timer = setInterval(() => {
      if (Date.now() - this.lastTurn < TURN_DECISION_TIME_MS || this.battle.victor) {
        return;
      }

      for (const account of this.accounts) {
        const player = this.battle.findPlayer(account.id);
        if (player && !player.choice && player.options) {
          this.server.broadcastTurn(this, this.battle.forfeit(player, "forfeit_timer"));
          return;
        }
      }
    }, 1000);

    this.endTurn();
    for (const account of this.accounts) {
      const info = this.timerInfo(account);
      if (info) {
        server.to(account.userRoom).emit("timerStart", this.id, initiator.id, info);
      }
    }
    return true;
  }

  timerInfo(_account: Account) {
    // TODO: per-player timer duration
    return this.timer && !this.battle.victor
      ? ({ startedAt: this.lastTurn, duration: TURN_DECISION_TIME_MS } satisfies BattleTimer)
      : undefined;
  }
}

class Account {
  battles = new Set<Room>();
  rooms = new Set<Room>();
  matchmaking?: FormatId;
  userRoom: string;

  constructor(public id: string, public name: string) {
    this.userRoom = `user:${this.id}`;
  }

  joinBattle(room: Room, server: GameServer) {
    this.joinRoom(room, server, false);
    this.battles.add(room);

    server.to(this.userRoom).emit("foundMatch", room.id);
  }

  joinRoom(room: Room, server: GameServer, notifyJoin: boolean) {
    if (this.rooms.has(room)) {
      return;
    }

    if (notifyJoin) {
      const player = room.battle.findPlayer(this.id);
      server
        .to(room.id)
        .emit("userJoin", room.id, this.name, this.id, !player, player?.team.length ?? 0);
    }
    room.accounts.add(this);
    this.rooms.add(room);
    server.in(this.userRoom).socketsJoin(room.id);
  }

  leaveRoom(room: Room, server: GameServer) {
    if (this.battles.has(room)) {
      // TODO: start room disconnect timer
      server.to(room.id).emit("userLeave", room.id, this.id);
      return;
    }

    room.accounts.delete(this);
    this.rooms.delete(room);
    server.in(this.userRoom).socketsLeave(room.id);
    server.to(room.id).emit("userLeave", room.id, this.id);
  }

  addSocket(socket: Socket) {
    socket.join(this.userRoom);
    for (const room of this.rooms) {
      socket.join(room.id); // XXXX --------------------------------------------------------
    }
  }

  async removeSocket(socket: Socket, server: GameServer) {
    socket.leave(this.userRoom);

    const sockets = await server.in(this.userRoom).fetchSockets();
    if (!sockets.length) {
      for (const room of [...this.rooms]) {
        this.leaveRoom(room, server);
      }
      return true;
    }
    return false;
  }
}

export class GameServer extends SocketIoServer<ClientMessage, ServerMessage> {
  /** User ID -> Account */
  private accounts: Record<string, Account> = {};
  private mmWaiting: Partial<Record<FormatId, [Player, Account]>> = {};
  rooms: Record<string, Room> = {};

  constructor(server?: any) {
    super(server);
    this.on("connection", socket => this.newConnection(socket));
    this.on("error", console.error);
    this.on("close", () => console.log("game server has closed..."));
  }

  private newConnection(socket: Socket) {
    // @ts-expect-error property does not exist
    const user: User | undefined = socket.request.__SOCKETIO_USER__;
    if (user) {
      console.log(`new connection: ${socket.id} from user: '${user.name}' (${user.id})`);
      socket.account = this.accounts[user.id] ??= new Account(user.id, user.name);
      socket.account.addSocket(socket);
    } else {
      console.log(`new connection: ${socket.id}`);
    }

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
        account.joinRoom(room, this, true);
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
        timer: account && room.timerInfo(account),
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
      const turn =
        type === "forfeit" ? room.battle.forfeit(player, "forfeit") : room.battle.nextTurn();
      if (turn) {
        this.broadcastTurn(room, turn);
      }
    });
    socket.on("cancel", (roomId, sequenceNo, ack) => {
      const info = this.validatePlayer(socket, roomId, sequenceNo);
      if (typeof info === "string") {
        return ack(info);
      }

      info[0].cancel();
      ack();
    });
    socket.on("startTimer", (roomId, ack) => {
      const room = this.rooms[roomId];
      if (!room) {
        return ack("bad_room");
      }

      const account = socket.account;
      if (!account || !account.rooms.has(room)) {
        return ack("not_in_room");
      } else if (!room.battle.findPlayer(account.id)) {
        return ack("not_in_battle");
      }

      ack(room.startTimer(account, this) ? "already_on" : undefined);
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
      this.sendChat(room, message, account.id, true);
    });
    socket.on("getRooms", ack =>
      ack(
        Object.entries(this.rooms)
          .filter(([, room]) => !room.battle.victor)
          .map(([id, room]) => ({
            id,
            players: [...room.accounts].filter(acc => acc.battles.has(room)).map(acc => acc.name),
            format: room.format,
          })),
      ),
    );
    socket.on("disconnect", async () => {
      const account = socket.account;
      if (account && (await account.removeSocket(socket, this))) {
        this.leaveMatchmaking(account);
      }
    });
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
      this.rooms[roomId] = new Room(roomId, battle, turn0, format, this);

      account.joinBattle(this.rooms[roomId], this);
      opponentAcc.joinBattle(this.rooms[roomId], this);

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

  broadcastTurn(room: Room, turn: Turn) {
    room.turns.push(turn);
    room.endTurn();

    const { switchTurn, events } = turn;
    for (const account of room.accounts) {
      const player = room.battle.findPlayer(account.id);
      const result = { switchTurn, events: GameServer.censorEvents(events, player) };
      this.to(account.userRoom).emit(
        "nextTurn",
        room.id,
        result,
        player?.options,
        room.timerInfo(account),
      );
    }

    this.to(`${ANON_SPECTATE}${room.id}`).emit("nextTurn", room.id, {
      switchTurn,
      events: GameServer.censorEvents(events),
    });
  }

  sendChat(room: Room, message: string, player: string, save: boolean) {
    const turn = Math.max(room.turns.length - 1, 0);
    if (save) {
      if (!room.chats[turn]) {
        room.chats[turn] = [];
      }
      room.chats[turn].push({ message, player });
    }
    this.to(room.id).emit("userChat", room.id, player, message, turn);
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
