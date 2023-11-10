import { type BattleEvent, type DamageReason, type PlayerId } from "./events";
import { moveList, type MoveId } from "./moveList";
import { type Move } from "./moves";
import { type Pokemon, type Status } from "./pokemon";
import { TransformedPokemon } from "./transformed";
import { clamp, randChance255, randRangeInclusive, type Type } from "./utils";

export type Choice =
    | { type: "switch"; turn: number; to: number }
    | { type: "move"; turn: number; index: number };

type MoveChoice = { move: MoveId; pp: number; valid: boolean; i: number };
type ChosenMove = {
    move: Move;
    choice: MoveChoice;
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
    choices?: { canSwitch: boolean; moves: MoveChoice[] };

    constructor(name: string, id: PlayerId, team: Pokemon[]) {
        this.active = new ActivePokemon(team[0], this);
        this.team = team;
        this.name = name;
        this.id = id;
    }

    updateChoices(gameOver: boolean) {
        if (gameOver) {
            this.choices = undefined;
            return;
        }

        let moves = this.active.base.moves.map((move, i) => ({
            move,
            pp: this.active.base.pp[i],
            valid: this.isValidMove(move, i),
            i,
        }));
        if (moves.every(move => !move.valid)) {
            moves = [{ move: "struggle", pp: 0, valid: true, i: -1 }];
        }

        this.choices = {
            canSwitch: !this.active.charging && !this.active.thrashing && !this.active.recharge,
            moves
        };
    }

    private isValidMove(move: MoveId, i: number) {
        // TODO: research these interactions
        //       user hyper beams, opponent disables: 
        //          is the user forced to recharge hyper beam ? struggle? does it recharge and fail?
        //       user clicks skull bash, opponent disables:

        if (this.active.recharge && this.active.recharge !== moveList[move]) {
            return false;
        }

        if (this.active.charging && this.active.charging !== moveList[move]) {
            return false;
        }

        if (this.active.thrashing && this.active.thrashing.move !== moveList[move]) {
            return false;
        }

        if (this.active.base.pp[i] === 0) {
            return false;
        }

        if (moveList[move] === this.active.disabled?.move) {
            return false;
        }

        return true;
    }
}

export class Battle {
    private readonly players: [Player, Player];
    private _turn = 0;
    private readonly events: BattleEvent[] = [];
    victor: Player | null = null;

    private constructor(player1: Player, player2: Player) {
        this.players = [player1, player2];
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
            const validChoice = player.choices?.moves[choice.index];
            if (!validChoice?.valid) {
                throw new SelectionError("invalid_choice");
            }

            player.choice = {
                choice: validChoice,
                move: moveList[validChoice.move],
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
        for (const { move, user, target, choice } of choices) {
            if (user.base.status === "frz") {
                this.pushEvent({
                    type: "info",
                    id: user.owner.id,
                    why: "frozen",
                });
                continue;
            } else if (user.base.status === "slp") {
                --user.base.sleep_turns;
                const done = user.base.sleep_turns === 0;
                if (done) {
                    user.base.status = null;
                }

                this.pushEvent({
                    type: "info",
                    id: user.owner.id,
                    why: done ? "wake" : "sleep",
                });
                continue;
            }

            if (user.flinch === this._turn) {
                this.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "flinch",
                });
                user.recharge = undefined;
                continue;
            }

            if (user.recharge) {
                this.pushEvent({
                    type: "info",
                    id: user.owner.id,
                    why: "recharge",
                });
                user.recharge = undefined;
                continue;
            }

            if (user.confusion) {
                this.pushEvent({
                    type: "info",
                    id: user.owner.id,
                    why: "confused"
                });
                // TODO: confusion damage
            }

            // A pokemon has died, skip all end of turn events
            if (move.use(this, user, target, choice.i)) {
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

        return this.endTurn();
    }

    private endTurn(): Turn {
        if (this.victor) {
            this.pushEvent({
                type: "victory",
                id: this.victor.id,
            });
        }

        for (const player of this.players) {
            player.choice = null;
            player.updateChoices(this.victor !== null);
        }

        return {
            turn: this._turn++,
            events: this.events.splice(0),
        };
    }
}

export type Stages = keyof ActivePokemon["stages"];

export type BooleanFlag = "light_screen" | "reflect" | "mist" | "focus";

export class ActivePokemon {
    readonly owner: Player;
    readonly stages = { atk: 0, def: 0, spc: 0, spe: 0, acc: 0, eva: 0 };
    types: Type[] = [];
    base: Pokemon;
    flags: Partial<Record<BooleanFlag, boolean>> = {};
    substitute = 0;
    confusion = 0;
    flinch = 0;
    counter = 1;
    seeded = false;
    invuln = false;
    charging?: Move;
    recharge?: Move;
    lastMove?: Move;
    thrashing?: { move: Move; turns: number, acc?: number };
    disabled?: { move: Move; turns: number };

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
        this.types = [...base.species.types];
        this.substitute = 0;
        this.confusion = 0;
        this.counter = 1;
        this.seeded = false;
        this.invuln = false;
        this.lastMove = undefined;
        this.thrashing = undefined;
        this.disabled = undefined;
        this.charging = undefined;
        this.recharge = undefined;
    }

    getStat(stat: "atk" | "def" | "spc" | "spe", isCrit: boolean): number {
        // TODO: apply stages, par/brn, stat duplication bug
        if (isCrit && this.base instanceof TransformedPokemon) {
            return this.base.base.stats[stat];
        }

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

        if (status === "slp") {
            this.recharge = undefined;
            this.base.sleep_turns = randRangeInclusive(1, 7);
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
        // TODO: update stats
        stages = stages.filter(([stage]) => Math.abs(this.stages[stage]) !== 6);
        for (const [stage, count] of stages) {
            this.stages[stage] = clamp(this.stages[stage] + count, -6, 6);
        }

        if (stages.length) {
            battle.pushEvent({
                type: "stages",
                id: this.owner.id,
                stages,
            });
        }

        return stages.length !== 0;
    }

    inflictConfusion(battle: Battle, thrashing?: true) {
        if (!thrashing && this.confusion) {
            return false;
        }

        this.confusion = randRangeInclusive(1, 4);
        if (!thrashing) {
            battle.pushEvent({
                type: "info",
                id: this.owner.id,
                why: "became_confused"
            });
        }
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
