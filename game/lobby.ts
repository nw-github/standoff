import { type Pokemon } from "./pokemon";
import { Battle, type Choice, Player, SelectionError, type Turn } from "./battle";
import { type PlayerId, type BattleEvent } from "./events";
import { EventEmitter } from "events";
import { hpPercent } from "./utils";

export declare interface Lobby {
    on(event: "turn", listener: (id: PlayerId, turn: number, events: string) => void): this;
    on(event: "endTurn", listener: (id: PlayerId, turn: number, validMoves: string) => void): this;
    on(event: "join", listener: (id: PlayerId, name: string) => void): this;
    on(event: "leave", listener: (id: PlayerId) => void): this;
    on(event: string, listener: Function): this;
}

export class Lobby extends EventEmitter {
    private readonly players: Player[] = [];
    private readonly spectators: Player[] = [];
    private nextId = 0;
    private battle: Battle | null = null;

    join(name: string, team?: Pokemon[]): PlayerId {
        const id = this.nextId++;
        if (team && this.players.length !== 2) {
            this.players.push(new Player(name, id, team));
        } else {
            this.spectators.push(new Player(name, id, []));
        }

        this.emit("join", id, name);
        return id;
    }

    leave(id: PlayerId) {
        const playerIdx = this.players.findIndex(player => player.id === id);
        if (playerIdx !== -1) {
            const [player] = this.players.splice(playerIdx, 1);
            this.emit("leave", player.id);
            // TODO: end the game
            return;
        }

        const specIdx = this.spectators.findIndex(player => player.id === id);
        if (specIdx !== -1) {
            const [player] = this.spectators.splice(specIdx, 1);
            this.emit("leave", player.id);
            return;
        }

        console.warn(`Unknown player with ID ${id} requested to leave.`);
    }

    startBattle() {
        if (this.battle || this.players.length !== 2) {
            return false;
        }

        const [battle, turn0] = Battle.start(this.players[0], this.players[1]);
        this.battle = battle;
        this.broadcastTurn(turn0);
        return true;
    }

    chooseFor(id: PlayerId, choice: Choice) {
        if (!this.battle) {
            // TODO: warn
            console.log("attempt to choose move before the battle started");
            return;
        }

        try {
            const turn = this.battle.choose(id, choice);
            if (turn) {
                this.broadcastTurn(turn);
            }
        } catch (err) {
            if (err instanceof SelectionError) {
                // TODO: respond
                console.warn("error choosing:", err.type);
            }
        }
    }

    cancelFor(id: PlayerId, turn: number) {
        if (!this.battle) {
            // TODO: warn
            console.log("attempt to cancel move before the battle started");
            return;
        }

        try {
            this.battle.cancel(id, turn);
        } catch (err) {
            if (err instanceof SelectionError) {
                // TODO: respond
                console.warn("error cancelling:", err.type);
            }
        }
    }

    isPlaying() {
        return this.battle !== null;
    }

    broadcastTurn({ turn, events }: Turn) {
        for (const player of this.players) {
            this.emit("turn", player.id, turn, Lobby.stringifyEventsFor(player, events));
        }

        let spectatorEvents;
        for (const player of this.spectators) {
            spectatorEvents ??= Lobby.stringifyEventsFor(player, events);
            this.emit("turn", player.id, turn, spectatorEvents);
        }

        if (this.battle?.victor) {
            this.battle = null;
        }

        for (const player of this.players) {
            this.emit("endTurn", player.id, turn, JSON.stringify(player.validMoves()));
        }
    }

    static stringifyEventsFor(player: Player, events: BattleEvent[]) {
        return JSON.stringify(events, (_, val) => {
            if (typeof val !== "object" || val === null) {
                return val;
            }

            const type = val.type;
            if (typeof type !== "string") {
                return val;
            }

            if (type === "damage" && val.target !== player.id) {
                return {
                    ...val,
                    hpBefore: hpPercent(val.hpBefore, val.maxHp),
                    hpAfter: hpPercent(val.hpAfter, val.maxHp),
                };
            } else if (type === "switch" && val.src !== player.id) {
                return {
                    ...val,
                    hp: hpPercent(val.hp, val.maxHp),
                    maxHp: 100,
                };
            }

            return val;
        });
    }
}
