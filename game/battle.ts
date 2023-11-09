import { type BattleEvent, type DamageReason, type PlayerId } from "./events";
import { moveList } from "./moveList";
import type { Move } from "./moves";
import { type Pokemon, type Status } from "./pokemon";
import { randChance255, randRangeInclusive, type Type } from "./utils";

export type Choice =
    | { type: "switch"; turn: number; to: number }
    | { type: "move"; turn: number; index: number };

type ChosenMove = {
    move: Move;
    user: ActivePokemon;
    target: ActivePokemon;
};

export class SelectionError extends Error {
    constructor(
        readonly type:
            | "cancel_too_late"
            | "choose_too_late"
            | "invalid_id"
            | "game_over"
            | "invalid_choice"
            | "battle_not_started"
    ) {
        super();
    }
}

export type Turn = {
    turn: number;
    events: BattleEvent[];
};

export class Player {
    readonly active: ActivePokemon;
    readonly name: string;
    readonly team: Pokemon[];
    choice: ChosenMove | null = null;
    id: PlayerId;

    constructor(name: string, id: PlayerId, team: Pokemon[]) {
        this.active = new ActivePokemon(team[0], this);
        this.team = team;
        this.name = name;
        this.id = id;
    }

    validMoves() {
        return {
            canSwitch: true,
            moves: this.active.base.moves.map((move, i) => ({ move, i })),
        };
    }
}

export class Battle {
    private readonly players: [Player, Player];
    private _turn = 0;
    private readonly events: BattleEvent[] = [];
    victor: Player | null = null;
    moveList: typeof moveList;

    private constructor(player1: Player, player2: Player) {
        this.players = [player1, player2];
        this.moveList = moveList;
    }

    static start(player1: Player, player2: Player): [Battle, Turn] {
        const self = new Battle(player1, player2);

        // TODO: is the initial switch order determined by speed?
        for (const player of self.players) {
            player.active.switchTo(player.active.base, self);
        }

        return [self, self.endTurn()];
    }

    get turn() {
        return this._turn;
    }

    cancel(id: PlayerId, turn: number) {
        const player = this.players.find(p => p.id === id);
        if (!player) {
            throw new SelectionError("invalid_id");
        }

        if (turn !== this._turn) {
            throw new SelectionError("cancel_too_late");
        }

        player.choice = null;
    }

    choose(id: PlayerId, choice: Choice) {
        if (this.victor) {
            throw new SelectionError("game_over");
        }

        const player = this.players.find(p => p.id === id);
        if (!player) {
            throw new SelectionError("invalid_id");
        }

        if (choice.turn !== this._turn) {
            throw new SelectionError("choose_too_late");
        }

        if (choice.type === "move") {
            const move = player.active.base.moves[choice.index];
            if (move === undefined) {
                throw new SelectionError("invalid_choice");
            }

            player.choice = {
                move: moveList[move],
                user: player.active,
                target: this.opponentOf(player).active,
            };
        } else if (choice.type === "switch") {
            throw new Error("TODO: switch moves");
        } else {
            throw new SelectionError("invalid_choice");
        }

        if (!this.players.every(player => player.choice !== null)) {
            return null;
        }

        return this.runTurn();
    }

    pushEvent(event: BattleEvent) {
        this.events.push(event);
    }

    opponentOf(player: Player): Player {
        return this.players[0] === player ? this.players[1] : this.players[0];
    }

    private runTurn() {
        const choices = this.players
            .map(player => player.choice!)
            .sort((a, b) => {
                if (a.move.priority !== b.move.priority) {
                    return (b.move.priority ?? 0) - (a.move.priority ?? 0);
                }

                const aSpe = a.user.owner.active.getStat("spe", false);
                const bSpe = b.user.owner.active.getStat("spe", false);
                if (aSpe === bSpe) {
                    return randChance255(128) ? -1 : 1;
                }

                return bSpe - aSpe;
            });

        let skipEnd = false;
        for (const { move, user, target } of choices) {
            if (user.flinch === this._turn) {
                this.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "flinch",
                });
                continue;
            }

            move.use(this, user);
            // A pokemon has died, skip all end of turn events
            if (move.execute(this, user, target)) {
                if (!this.victor) {
                    if (target.owner.team.every(poke => poke.hp <= 0)) {
                        this.victor = user.owner;
                    } else if (user.owner.team.every(poke => poke.hp <= 0)) {
                        this.victor = target.owner;
                    }
                }

                skipEnd = true;
                break;
            }
        }

        if (!skipEnd) {
            for (const { user } of choices) {
                if (user.base.status === "tox" && user.tickCounter(this, "psn")) {
                    break;
                }

                if (user.base.status === "brn" && user.tickCounter(this, "brn")) {
                    break;
                }

                if (user.seeded && user.tickCounter(this, "seeded")) {
                    break;
                }
            }
        }

        for (const player of this.players) {
            player.choice = null;
        }

        if (this.victor) {
            this.pushEvent({
                type: "victory",
                id: this.victor.id,
            });
        }

        return this.endTurn();
    }

    private endTurn(): Turn {
        return {
            turn: this._turn++,
            events: this.events.splice(0),
        };
    }
}

export type Stages = keyof ActivePokemon["stages"];

export type BooleanFlag = "light_screen" | "reflect" | "mist" | "focus";

export class ActivePokemon {
    base: Pokemon;
    flags: Partial<Record<BooleanFlag, boolean>> = {};
    substitute = 0;
    confusion = 0;
    flinch = 0;
    counter = 1;
    seeded = false;
    recharge?: Move;
    lastMove?: Move;
    readonly owner: Player;
    readonly types: Type[] = [];
    readonly stages = { atk: 0, def: 0, spc: 0, spe: 0, acc: 0, eva: 0 };

    constructor(base: Pokemon, owner: Player) {
        this.base = base;
        this.owner = owner;
    }

    switchTo(base: Pokemon, battle: Battle) {
        if (base.status === "tox") {
            base.status = "psn";
        }

        battle.pushEvent({
            type: "switch",
            dexId: base.species.dexId,
            status: base.status,
            hp: base.hp,
            maxHp: base.stats.hp,
            src: this.owner.id,
            name: base.name,
        });

        this.base = base;
        for (const k in this.stages) {
            // @ts-ignore
            this.stages[k] = 0;
        }
        for (const k in this.flags) {
            // @ts-ignore
            this.flags[k] = false;
        }
        this.types.length = 0;
        this.types.push(...base.species.types);
        this.substitute = 0;
        this.lastMove = undefined;
        this.counter = 1;
        this.seeded = false;
    }

    getStat(stat: "atk" | "def" | "spc" | "spe", isCrit: boolean): number {
        // TODO: apply stages, par/brn, stat duplication bug
        return this.base.stats[stat];
    }

    inflictDamage(
        dmg: number,
        src: ActivePokemon,
        battle: Battle,
        isCrit: boolean,
        why: DamageReason,
        direct?: boolean,
        eff?: number
    ) {
        let dealt: number;
        let brokeSub = false;
        if (this.substitute !== 0 && !direct) {
            const hpBefore = this.substitute;
            this.substitute = Math.max(this.substitute - dmg, 0);
            battle.pushEvent({
                type: "hit_sub",
                src: src.owner.id,
                target: this.owner.id,
                broken: this.substitute === 0,
                eff,
            });
            dealt = hpBefore - this.substitute;
            brokeSub = this.substitute === 0;
        } else {
            const hpBefore = this.base.hp;
            this.base.hp =
                dmg > 0
                    ? Math.max(this.base.hp - dmg, 0)
                    : Math.min(this.base.hp - dmg, this.base.stats.hp);
            if (this.base.hp === hpBefore) {
                return { dealt: 0, brokeSub: false, dead: false };
            }

            battle.pushEvent({
                type: "damage",
                src: src.owner.id,
                target: this.owner.id,
                maxHp: this.base.stats.hp,
                hpAfter: this.base.hp,
                hpBefore,
                why,
                eff,
                isCrit,
            });
            dealt = hpBefore - this.base.hp;
        }

        return { dealt, brokeSub, dead: this.base.hp === 0 };
    }

    inflictStatus(status: Status, battle: Battle) {
        if (this.base.status !== null) {
            return false;
        }

        this.base.status = status;
        battle.pushEvent({
            type: "status",
            id: this.owner.id,
            status,
        });
        return true;
    }

    inflictStages(stages: [Stages, number][], battle: Battle) {
        // TODO: update stats/stages
        const changed: [Stages, number][] = [];
        for (const [stage, count] of stages) {
            if (Math.abs(this.stages[stage]) !== 6) {
                this.stages[stage] = Math.max(Math.min(this.stages[stage] + count, 6), -6);
                changed.push([stage, count]);
            }
        }

        if (changed.length) {
            battle.pushEvent({
                type: "stages",
                id: this.owner.id,
                stages: changed,
            });
        }

        return changed.length !== 0;
    }

    inflictConfusion(battle: Battle) {
        if (this.confusion) {
            return false;
        }

        this.confusion = randRangeInclusive(1, 4);
        battle.pushEvent({
            type: "confusion",
            id: this.owner.id,
        });
        return true;
    }

    tickCounter(battle: Battle, why: DamageReason) {
        const dmg = this.counter * Math.max(this.base.stats.hp / 16, 1);
        const { dead } = this.inflictDamage(dmg, this, battle, false, why, true);
        const opponent = battle.opponentOf(this.owner).active;
        if (why === "seeded" && opponent.base.hp < opponent.base.stats.hp) {
            opponent.inflictDamage(-dmg, this, battle, false, "seeder", true);
        }

        if (this.base.status === "tox") {
            this.counter++;
        }
        return dead;
    }
}
