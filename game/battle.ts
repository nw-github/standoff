import { type BattleEvent, type DamageReason, type PlayerId } from "./events";
import { moveList, type MoveId } from "./moveList";
import { Move } from "./moves";
import { type Pokemon, type Status } from "./pokemon";
import { TransformedPokemon } from "./transformed";
import {
    calcDamage,
    clamp,
    floatTo255,
    randChance255,
    randRangeInclusive,
    stageMultipliers,
    type Type,
} from "./utils";

export type Choice =
    | { type: "switch"; turn: number; to: number }
    | { type: "move"; turn: number; index: number };

export type MoveChoice = { move: MoveId; pp: number; valid: boolean; indexInMoves?: number };
type ChosenMove = {
    move: Move;
    choice?: MoveChoice;
    user: ActivePokemon;
};

class SwitchMove extends Move {
    constructor(readonly poke: Pokemon) {
        super("", 0, "normal", undefined, +2);
    }

    override use(battle: Battle, user: ActivePokemon): boolean {
        return this.execute(battle, user);
    }

    override execute(battle: Battle, user: ActivePokemon): boolean {
        user.switchTo(this.poke, battle);
        return false;
    }
}

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
    readonly id: PlayerId;
    choice: ChosenMove | null = null;
    choices?: { canSwitch: boolean; moves: MoveChoice[] };

    constructor(name: string, id: PlayerId, team: Pokemon[]) {
        this.active = new ActivePokemon(team[0], this);
        this.team = team;
        this.name = name;
        this.id = id;
    }

    updateChoices(battle: Battle) {
        if (battle.victor || (!battle.opponentOf(this).active.base.hp && this.active.base.hp)) {
            this.choices = undefined;
            return;
        }

        let moves: MoveChoice[] = this.active.base.moves.map((move, i) => ({
            move,
            pp: this.active.base.pp[i],
            valid: this.isValidMove(move, i),
            indexInMoves: i,
        }));

        if (!this.active.base.hp) {
            for (const move of moves) {
                move.valid = false;
            }
        } else if (moves.every(move => !move.valid)) {
            const metronome = [
                this.active.charging,
                this.active.thrashing?.move,
                this.active.recharge,
            ];
            moves.length = 0;
            for (const move of metronome) {
                if (move) {
                    moves = [{ move: battle.moveIdOf(move)!, pp: -1, valid: true }];
                    break;
                }
            }

            if (!moves.length) {
                moves = [{ move: "struggle", pp: -1, valid: true }];
            }
        }

        const canSwitch = !this.active.charging && !this.active.thrashing && !this.active.recharge;
        this.choices = {
            canSwitch: canSwitch || this.active.base.hp === 0,
            moves,
        };
    }

    private isValidMove(move: MoveId, i: number) {
        // TODO: research these interactions
        //       user hyper beams, opponent disables:
        //          is the user forced to recharge hyper beam ? struggle? does it recharge and fail?
        //       user clicks skull bash, opponent disables:

        if (this.active.recharge && this.active.recharge !== moveList[move]) {
            return false;
        } else if (this.active.charging && this.active.charging !== moveList[move]) {
            return false;
        } else if (this.active.thrashing && this.active.thrashing.move !== moveList[move]) {
            return false;
        } else if (this.active.base.status === "frz") {
            // https://bulbapedia.bulbagarden.net/wiki/List_of_battle_glitches_(Generation_I)#Defrost_move_forcing
            // XXX: Gen 1 doesn't let you pick your move when frozen, so if you are defrosted
            // before your turn, the game can desync. The logic we implement follows with what the
            // opponent player's game would do :shrug:

            // Gen 1 also doesn't let you pick your move while asleep, but you can't wake up and act
            // on the same turn, nor can you act on the turn haze removes your non-volatile status,
            // so it doesn't matter.
            if (this.active.lastMove && this.active.lastMove !== moveList[move]) {
                return false;
            }

            return this.active.lastMove ? true : i === 0;
        } else if (moveList[move] === this.active.disabled?.move) {
            return false;
        } else if (this.active.base.pp[i] === 0) {
            return false;
        }

        return true;
    }
}

export class Battle {
    private readonly players: [Player, Player];
    private _turn = 0;
    private readonly events: BattleEvent[] = [];
    private readonly moveListToId;
    victor: Player | null = null;

    private constructor(player1: Player, player2: Player) {
        this.players = [player1, player2];
        const rev = new Map<Move, MoveId>();
        for (const k in moveList) {
            // @ts-ignore
            rev.set(moveList[k], k);
        }
        this.moveListToId = rev;
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
            };
        } else if (choice.type === "switch") {
            if (!player.choices?.canSwitch) {
                throw new SelectionError("invalid_choice");
            }

            const selected = player.team[choice.to];
            const current = player.active.base;
            if (!selected || selected === current || !selected.hp) {
                throw new SelectionError("invalid_choice");
            }

            if (current instanceof TransformedPokemon && selected === current.base) {
                throw new SelectionError("invalid_choice");
            }

            player.choice = {
                move: new SwitchMove(selected),
                user: player.active,
            };
        } else {
            throw new SelectionError("invalid_choice");
        }

        if (!this.players.every(player => !player.choices || player.choice)) {
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

    moveIdOf(move: Move) {
        return this.moveListToId.get(move);
    }

    private runTurn() {
        const choices = this.players
            .filter(player => player.choice)
            .map(player => player.choice!)
            .sort((a, b) => {
                const aPri = a.move.priority ?? 0, bPri = b.move.priority ?? 0;
                if (aPri !== bPri) {
                    console.log(
                        `Priority: ${a.move.name} (${aPri}) vs`,
                        `${b.move.name} (${bPri})`
                    );
                    return bPri - aPri;
                }

                const aSpe = a.user.owner.active.getStat("spe");
                const bSpe = b.user.owner.active.getStat("spe");
                if (aSpe === bSpe) {
                    console.log(`Speed tie: ${aSpe}`);
                    return randChance255(128) ? -1 : 1;
                }

                console.log(
                    `Speed: ${a.user.base.name} (${aSpe}) vs`,
                    `${b.user.base.name} (${bSpe})`
                );
                return bSpe - aSpe;
            });

        let skipEnd = false;
        for (const { move, user, choice } of choices) {
            const target = this.opponentOf(user.owner).active;
            if (!(move instanceof SwitchMove)) {
                if (user.hazed) {
                    continue;
                } else if (user.base.status === "frz") {
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
                } else if (user.flinch === this._turn) {
                    this.pushEvent({
                        type: "failed",
                        src: user.owner.id,
                        why: "flinch",
                    });
                    user.recharge = undefined;
                    continue;
                } else if (user.recharge) {
                    this.pushEvent({
                        type: "info",
                        id: user.owner.id,
                        why: "recharge",
                    });
                    user.recharge = undefined;
                    continue;
                } else if (user.base.status === "par" && randChance255(floatTo255(25))) {
                    this.pushEvent({
                        type: "info",
                        id: user.owner.id,
                        why: "paralyze",
                    });

                    user.charging = undefined;
                    user.thrashing = undefined;
                    continue;
                }

                if (user.confusion) {
                    --user.confusion;
                    if (user.confusion === 0) {
                        this.pushEvent({
                            type: "info",
                            id: user.owner.id,
                            why: "confused_end",
                        });
                    } else {
                        this.pushEvent({
                            type: "info",
                            id: user.owner.id,
                            why: "confused",
                        });

                        if (randChance255(floatTo255(50))) {
                            if (user.handleConfusionDamage(this, target)) {
                                skipEnd = true;
                                break;
                            } else {
                                continue;
                            }
                        }
                    }
                }
            }

            if (move.use(this, user, target, choice?.indexInMoves)) {
                // A pokemon has died, skip all end of turn events
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

            if (move.power && user.handleStatusDamage(this)) {
                skipEnd = true;
                break;
            }

            if (user.seeded && user.tickCounter(this, "seeded")) {
                skipEnd = true;
                break;
            }
        }

        if (!skipEnd) {
            for (const { user } of choices) {
                user.handleStatusDamage(this);
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
            player.active.handledStatus = false;
            player.active.hazed = false;
            player.updateChoices(this);
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
    stats = { atk: 0, def: 0, spc: 0, spe: 0 };
    types: Type[] = [];
    base: Pokemon;
    flags: Partial<Record<BooleanFlag, boolean>> = {};
    substitute = 0;
    confusion = 0;
    flinch = 0;
    counter = 1;
    seeded = false;
    invuln = false;
    handledStatus = false;
    hazed = false;
    charging?: Move;
    recharge?: Move;
    lastMove?: Move;
    thrashing?: { move: Move; turns: number; acc?: number };
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
            speciesId: base.speciesId,
            status: base.status,
            hp: base.hp,
            maxHp: base.stats.hp,
            src: this.owner.id,
            name: base.name,
            level: base.level,
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
        this.stats = { ...base.stats };
        this.substitute = 0;
        this.confusion = 0;
        this.counter = 1;
        this.seeded = false;
        this.invuln = false;
        this.handledStatus = false;
        this.hazed = false;
        this.lastMove = undefined;
        this.thrashing = undefined;
        this.disabled = undefined;
        this.charging = undefined;
        this.recharge = undefined;
        this.applyStatusDebuff();
    }

    getStat(
        stat: keyof ActivePokemon["stats"],
        isCrit?: boolean,
        def?: boolean,
        screen?: boolean
    ): number {
        if (!def && isCrit && this.base instanceof TransformedPokemon) {
            return this.base.base.stats[stat];
        }

        if (isCrit) {
            return this.base.stats[stat];
        }

        let res = this.stats[stat];
        if (screen) {
            res *= 2;
            if (res > 1024) {
                res -= res % 1024;
            }
        }

        return res;
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
                confusion: why === "confusion",
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

    inflictStatus(status: Status, battle: Battle, override: boolean = false) {
        if (!override && this.base.status !== null) {
            return false;
        }

        if (status === "slp") {
            this.recharge = undefined;
            this.base.sleep_turns = randRangeInclusive(1, 7);
        }

        if (status === "tox") {
            this.counter = 1;
        }

        this.base.status = status;
        this.handledStatus = false;
        battle.pushEvent({
            type: "status",
            id: this.owner.id,
            status,
        });

        this.applyStatusDebuff();
        return true;
    }

    inflictStages(mods: [Stages, number][], battle: Battle) {
        mods = mods.filter(([stat]) => Math.abs(this.stages[stat]) !== 6);

        const opponent = battle.opponentOf(this.owner).active;
        for (const [stat, count] of mods) {
            this.stages[stat] = clamp(this.stages[stat] + count, -6, 6);

            if (stat === "atk" || stat === "def" || stat == "spc" || stat === "spe") {
                this.stats[stat] = Math.floor(
                    this.base.stats[stat] * (stageMultipliers[this.stages[stat]] / 100)
                );
                // https://www.smogon.com/rb/articles/rby_mechanics_guide#stat-mechanics
                if (count < 0) {
                    this.stats[stat] %= 1024;
                }

                this.stats[stat] = clamp(this.stats[stat], 1, 999);
            }

            // https://bulbapedia.bulbagarden.net/wiki/List_of_battle_glitches_(Generation_I)#Stat_modification_errors
            opponent.applyStatusDebuff();
        }

        if (mods.length) {
            battle.pushEvent({
                type: "stages",
                id: this.owner.id,
                stages: mods,
                stats: {...this.stats},
            });
        }

        return mods.length !== 0;
    }

    inflictConfusion(battle: Battle, thrashing?: true) {
        if (!thrashing && this.confusion) {
            return false;
        }

        this.confusion = randRangeInclusive(2, 5);
        if (!thrashing) {
            battle.pushEvent({
                type: "info",
                id: this.owner.id,
                why: "became_confused",
            });
        }
        return true;
    }

    tickCounter(battle: Battle, why: DamageReason) {
        const multiplier = this.base.status === "psn" && why === "psn" ? 1 : this.counter;
        const dmg = Math.floor(multiplier * Math.max(this.base.stats.hp / 16, 1));
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

    handleStatusDamage(battle: Battle) {
        if (this.handledStatus) {
            return false;
        }

        this.handledStatus = true;
        if (this.base.status === "tox" && this.tickCounter(battle, "psn")) {
            return true;
        }

        if (this.base.status === "brn" && this.tickCounter(battle, "brn")) {
            return true;
        }

        if (this.base.status === "psn" && this.tickCounter(battle, "psn")) {
            return true;
        }

        return false;
    }

    applyStatusDebuff() {
        if (this.base.status === "brn") {
            this.stats.atk = Math.floor(Math.max(this.stats.atk / 2, 1));
        }

        if (this.base.status === "par") {
            this.stats.spe = Math.floor(Math.max(this.stats.spe / 4, 1));
        }
    }

    handleConfusionDamage(battle: Battle, target: ActivePokemon) {
        const dmg = calcDamage({
            lvl: this.base.level,
            crit: 1,
            pow: 40,
            def: this.getStat("def", false, true, target.flags.reflect),
            atk: this.stats.atk,
            stab: 1,
            eff: 1,
        });

        if (this.substitute && target.substitute) {
            target.inflictDamage(dmg, this, battle, false, "confusion");
        } else if (!this.substitute) {
            return this.inflictDamage(dmg, this, battle, false, "confusion").dead;
        }

        return false;
    }
}
