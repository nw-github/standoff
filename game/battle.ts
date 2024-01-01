import type {
    HitSubstituteEvent,
    BattleEvent,
    DamageEvent,
    DamageReason,
    PlayerId,
    RecoveryReason,
    InfoReason,
} from "./events";
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
    type Stages,
    type Type,
} from "./utils";

export type MoveOption = {
    move: MoveId;
    valid: boolean;
    display: boolean;
    pp?: number;
    indexInMoves?: number;
};

type ChosenMove = {
    move: Move;
    indexInMoves?: number;
    user: ActivePokemon;
};

class SwitchMove extends Move {
    constructor(readonly poke: Pokemon) {
        super("", 0, "normal", undefined, +2);
    }

    override use(battle: Battle, user: ActivePokemon) {
        this.execute(battle, user);
    }

    override execute(battle: Battle, user: ActivePokemon) {
        user.switchTo(this.poke, battle);
    }
}

export type Turn = {
    events: BattleEvent[];
    switchTurn: boolean;
};

export class Player {
    readonly active: ActivePokemon;
    readonly team: Pokemon[];
    readonly id: PlayerId;
    choice?: ChosenMove;
    options?: { canSwitch: boolean; moves: MoveOption[] };

    constructor(id: PlayerId, team: Pokemon[]) {
        this.active = new ActivePokemon(team[0], this);
        this.team = team;
        this.id = id;
    }

    cancel() {
        this.choice = undefined;
    }

    chooseMove(index: number) {
        const choice = this.options?.moves[index];
        if (!choice?.valid) {
            return false;
        }

        this.choice = {
            indexInMoves: choice.indexInMoves,
            move: moveList[choice.move],
            user: this.active,
        };
        return true;
    }

    chooseSwitch(index: number) {
        if (!this.options?.canSwitch) {
            return false;
        }

        const poke = this.team[index];
        const current = this.active.base;
        if (!poke || poke === current || !poke.hp) {
            return false;
        } else if (current instanceof TransformedPokemon && poke === current.base) {
            return false;
        }

        this.choice = { move: new SwitchMove(poke), user: this.active };
        return true;
    }

    updateOptions(battle: Battle) {
        const { active } = this;
        if (battle.victor || (!battle.opponentOf(this).active.base.hp && active.base.hp)) {
            this.options = undefined;
            return;
        }

        // send all moves so PP can be updated
        const moves: MoveOption[] = active.base.moves.map((m, i) => {
            const move = active.v.mimic?.indexInMoves === i ? active.v.mimic?.move : m;
            return {
                move,
                pp: active.base.pp[i],
                valid: this.isValidMove(move, i),
                indexInMoves: i,
                display: true,
            };
        });

        const lockedIn = active.v.lockedIn();
        if (!active.base.hp) {
            for (const move of moves) {
                move.valid = false;
            }
        } else if (moves.every(move => !move.valid)) {
            // Two-turn moves, thrashing moves, and recharging skip the normal move selection menu
            moves.forEach(move => (move.display = false));
            moves.push({
                move: lockedIn ? battle.moveIdOf(lockedIn)! : "struggle",
                valid: true,
                display: true,
            });
        }

        const moveLocked = !!(active.v.bide || active.v.trapping);
        this.options = {
            canSwitch: !lockedIn || moveLocked || active.base.hp === 0,
            moves,
        };
    }

    isAllDead() {
        return this.team.every(poke => poke.hp === 0);
    }

    private isValidMove(move: MoveId, i: number) {
        if (this.active.v.lockedIn() && this.active.v.lockedIn() !== moveList[move]) {
            return false;
        } else if (this.active.base.status === "frz" || this.active.base.status === "slp") {
            // https://bulbapedia.bulbagarden.net/wiki/List_of_battle_glitches_(Generation_I)#Defrost_move_forcing
            // XXX: Gen 1 doesn't let you pick your move when frozen, so if you are defrosted
            // before your turn, the game can desync. The logic we implement follows with what the
            // opponent player's game would do :shrug:

            // This also implements the bug in which pokemon who are frozen/put to sleep on the turn
            // they use a modified priority move retain that priority until they wake up/thaw.
            return (this.active.v.lastMoveIndex ?? 0) === i;
        } else if (i === this.active.v.disabled?.indexInMoves) {
            return false;
        } else if (this.active.base.pp[i] === 0) {
            return false;
        }

        return true;
    }
}

export class Battle {
    readonly players: [Player, Player];
    private readonly events: BattleEvent[] = [];
    private readonly moveListToId;
    private switchTurn = false;
    _victor?: Player;

    private constructor(player1: Player, player2: Player) {
        this.players = [player1, player2];
        this.moveListToId = new Map<Move, MoveId>();
        for (const k in moveList) {
            // @ts-ignore
            this.moveListToId.set(moveList[k], k);
        }
    }

    static start(player1: Player, player2: Player) {
        const self = new Battle(player1, player2);

        // TODO: is the initial switch order determined by speed?
        for (const player of self.players) {
            player.active.switchTo(player.active.base, self);
        }

        return [self, self.endTurn()] as const;
    }

    get victor() {
        return this._victor;
    }

    event<T extends BattleEvent>(event: T) {
        this.events.push(event);
        return event;
    }

    info(src: ActivePokemon, why: InfoReason) {
        return this.event({ type: "info", id: src.owner.id, why });
    }

    opponentOf(player: Player): Player {
        return this.players[0] === player ? this.players[1] : this.players[0];
    }

    moveIdOf(move: Move) {
        return this.moveListToId.get(move);
    }

    nextTurn() {
        if (!this.players.every(player => !player.options || player.choice)) {
            return;
        }

        const choices = this.players
            .flatMap(({ choice }) => (choice ? [choice] : []))
            .sort((a, b) => {
                const aPri = a.move.priority ?? 0,
                    bPri = b.move.priority ?? 0;
                if (aPri !== bPri) {
                    return bPri - aPri;
                }

                const aSpe = a.user.owner.active.getStat("spe");
                const bSpe = b.user.owner.active.getStat("spe");
                if (aSpe === bSpe) {
                    return randChance255(128) ? -1 : 1;
                }

                return bSpe - aSpe;
            });

        let skipEnd = false;
        for (const choice of choices) {
            if (choice.move instanceof SwitchMove) {
                choice.move.use(this, choice.user);
                continue;
            }

            const target = this.opponentOf(choice.user.owner).active;
            if (this.userMove(choice, target) || choice.user.handleRecurrentDamage(this)) {
                if (!this._victor) {
                    if (target.owner.isAllDead()) {
                        this._victor = choice.user.owner;
                    } else if (choice.user.owner.isAllDead()) {
                        this._victor = target.owner;
                    }
                }

                skipEnd = true;
                break;
            }
        }

        if (!skipEnd && !this.switchTurn) {
            for (const { user } of choices) {
                if (user.handleStatusDamage(this)) {
                    if (user.owner.isAllDead()) {
                        this._victor = this.opponentOf(user.owner);
                    }
                    break;
                }
            }
        }

        return this.endTurn();
    }

    private userMove({ move, user, indexInMoves }: ChosenMove, target: ActivePokemon) {
        if (user.v.trapped) {
            this.info(user, "trapped");
            return;
        } else if (user.v.trapping && target.v.trapped) {
            const dead = target.damage(user.v.trapping.dmg, user, this, false, "trap").dead;
            if (dead || --user.v.trapping.turns === 0) {
                user.v.trapping = undefined;
            }

            return dead;
        } else if (user.v.flinch) {
            this.info(user, "flinch");
            user.v.recharge = undefined;
            return;
        } else if (user.v.hazed) {
            return;
        } else if (user.base.status === "frz") {
            this.info(user, "frozen");
            return;
        } else if (user.base.status === "slp") {
            const done = --user.base.sleepTurns === 0;
            if (done) {
                user.base.status = undefined;
            }

            this.info(user, done ? "wake" : "sleep");
            return;
        } else if (user.v.recharge) {
            this.info(user, "recharge");
            user.v.recharge = undefined;
            return;
        }

        if (user.v.disabled && --user.v.disabled.turns === 0) {
            user.v.disabled = undefined;
            this.info(user, "disable_end");
        }

        if (user.v.confusion) {
            this.info(user, --user.v.confusion === 0 ? "confused_end" : "confused");
        }

        if (user.base.status === "par" && randChance255(floatTo255(25))) {
            this.info(user, "paralyze");

            user.v.charging = undefined;
            user.v.bide = undefined;
            if (user.v.thrashing?.turns !== -1) {
                user.v.thrashing = undefined;
            }
            return;
        } else if (user.v.confusion && randChance255(floatTo255(50))) {
            return user.handleConfusionDamage(this, target);
        }

        return move.use(this, user, target, indexInMoves);
    }

    private endTurn(): Turn {
        if (this.victor) {
            this.event({ type: "victory", id: this.victor.id });
        }

        for (const player of this.players) {
            player.choice = undefined;
            player.active.v.handledStatus = false;
            player.active.v.hazed = false;
            player.active.v.flinch = false;
            if (player.active.v.trapped && !this.opponentOf(player).active.v.trapping) {
                player.active.v.trapped = false;
            }
            player.updateOptions(this);
        }

        const switchTurn = this.switchTurn;
        this.switchTurn = this.players.some(pl => pl.active.base.hp === 0);
        return { events: this.events.splice(0), switchTurn };
    }
}

export class ActivePokemon {
    v: Volatiles;

    constructor(public base: Pokemon, public readonly owner: Player) {
        this.base = base;
        this.owner = owner;
        this.v = new Volatiles(base);
    }

    switchTo(next: Pokemon, battle: Battle) {
        if (this.base.status === "tox") {
            this.base.status = "psn";
        }

        battle.event({
            type: "switch",
            speciesId: next.speciesId,
            status: next.status,
            hp: next.hp,
            maxHp: next.stats.hp,
            src: this.owner.id,
            name: next.name,
            level: next.level,
            indexInTeam: this.owner.team.indexOf(next),
        });

        this.base = next;
        this.v = new Volatiles(next);
        this.applyStatusDebuff();
    }

    getStat(stat: keyof VolatileStats, isCrit?: boolean, def?: boolean, screen?: boolean) {
        if (!def && isCrit && this.base instanceof TransformedPokemon) {
            return this.base.base.stats[stat];
        } else if (isCrit) {
            return this.base.stats[stat];
        }

        let res = this.v.stats[stat];
        if (screen) {
            res *= 2;
            if (res > 1024) {
                res -= res % 1024;
            }
        }

        return res;
    }

    damage(
        dmg: number,
        src: ActivePokemon,
        battle: Battle,
        isCrit: boolean,
        why: DamageReason,
        direct?: boolean,
        eff?: number
    ) {
        if (why === "attacked" || why === "confusion" || why === "recoil" || why === "crash") {
            // Counter uses the damage it would've done ignoring substitutes
            this.v.lastDamage = Math.min(this.base.hp, dmg);
        }

        if (this.v.substitute !== 0 && !direct) {
            const hpBefore = this.v.substitute;
            this.v.substitute = Math.max(this.v.substitute - dmg, 0);
            const event = battle.event<HitSubstituteEvent>({
                type: "hit_sub",
                src: src.owner.id,
                target: this.owner.id,
                broken: this.v.substitute === 0,
                confusion: why === "confusion",
                eff,
            });
            if (why === "attacked") {
                this.handleRage(battle);
            }
            return {
                event,
                dealt: hpBefore - this.v.substitute,
                brokeSub: this.v.substitute === 0,
            };
        } else {
            const hpBefore = this.base.hp;
            this.base.hp = Math.max(this.base.hp - dmg, 0);
            const event = battle.event<DamageEvent>({
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
            if (why === "attacked") {
                this.handleRage(battle);
            }

            return {
                event,
                dealt: hpBefore - this.base.hp,
                brokeSub: false,
                dead: this.base.hp === 0 ? true as const : undefined,
            };
        }
    }

    recover(amount: number, src: ActivePokemon, battle: Battle, why: RecoveryReason) {
        const hpBefore = this.base.hp;
        this.base.hp = Math.min(this.base.hp + amount, this.base.stats.hp);
        if (this.base.hp !== hpBefore) {
            battle.event({
                type: "recover",
                src: src.owner.id,
                target: this.owner.id,
                maxHp: this.base.stats.hp,
                hpAfter: this.base.hp,
                hpBefore,
                why,
            });
        }
    }

    status(status: Status, battle: Battle, override = false) {
        if (!override && this.base.status) {
            return false;
        }

        if (status === "slp") {
            this.v.recharge = undefined;
            this.base.sleepTurns = randRangeInclusive(1, 7);
        } else if (status === "tox") {
            this.v.counter = 1;
        }

        this.base.status = status;
        this.v.handledStatus = false;
        this.applyStatusDebuff();
        battle.event({
            type: "status",
            id: this.owner.id,
            status,
            stats: { ...this.v.stats },
        });

        return true;
    }

    modStages(user: Player, mods: [Stages, number][], battle: Battle) {
        mods = mods.filter(([stat]) => Math.abs(this.v.stages[stat]) !== 6);

        const opponent = battle.opponentOf(user).active;
        for (const [stat, count] of mods) {
            this.v.stages[stat] = clamp(this.v.stages[stat] + count, -6, 6);

            if (stat === "atk" || stat === "def" || stat == "spc" || stat === "spe") {
                this.applyStages(stat, count < 0);
            }

            // https://bulbapedia.bulbagarden.net/wiki/List_of_battle_glitches_(Generation_I)#Stat_modification_errors
            opponent.applyStatusDebuff();
        }

        if (mods.length) {
            battle.event({
                type: "stages",
                id: this.owner.id,
                stages: mods,
                stats: { ...this.v.stats },
            });
        }

        return mods.length !== 0;
    }

    confuse(battle: Battle, thrashing?: true) {
        if (!thrashing && this.v.confusion) {
            return false;
        }

        this.v.confusion = randRangeInclusive(2, 5);
        if (!thrashing) {
            battle.info(this, "became_confused");
        }
        return true;
    }

    tickCounter(battle: Battle, why: DamageReason) {
        const multiplier = this.base.status === "psn" && why === "psn" ? 1 : this.v.counter;
        const dmg = Math.max(Math.floor((multiplier * this.base.stats.hp) / 16), 1);
        const { dead } = this.damage(dmg, this, battle, false, why, true);
        const opponent = battle.opponentOf(this.owner).active;
        if (why === "seeded" && opponent.base.hp < opponent.base.stats.hp) {
            opponent.recover(dmg, this, battle, "seeder");
        }

        if (this.base.status === "tox") {
            this.v.counter++;
        }
        return dead;
    }

    handleStatusDamage(battle: Battle) {
        if (!this.v.handledStatus) {
            this.v.handledStatus = true;
            return (
                (this.base.status === "tox" && this.tickCounter(battle, "psn")) ||
                (this.base.status === "psn" && this.tickCounter(battle, "psn")) ||
                (this.base.status === "brn" && this.tickCounter(battle, "brn"))
            );
        }
    }

    handleRage(battle: Battle) {
        if (this.base.hp && this.v.thrashing?.move === moveList.rage && this.v.stages.atk < 6) {
            battle.info(this, "rage");
            this.modStages(this.owner, [["atk", +1]], battle);
        }
    }

    applyStatusDebuff() {
        if (this.base.status === "brn") {
            this.v.stats.atk = Math.floor(Math.max(this.v.stats.atk / 2, 1));
        } else if (this.base.status === "par") {
            this.v.stats.spe = Math.floor(Math.max(this.v.stats.spe / 4, 1));
        }
    }

    handleConfusionDamage(battle: Battle, target: ActivePokemon) {
        const dmg = calcDamage({
            lvl: this.base.level,
            crit: 1,
            pow: 40,
            def: this.getStat("def", false, true, target.v.flags.reflect),
            atk: this.v.stats.atk,
            stab: 1,
            eff: 1,
        });

        if (this.v.substitute && target.v.substitute) {
            target.damage(dmg, this, battle, false, "confusion");
        } else if (!this.v.substitute) {
            return this.damage(dmg, this, battle, false, "confusion").dead;
        }
    }

    handleRecurrentDamage(battle: Battle) {
        return (
            this.handleStatusDamage(battle) ||
            (this.v.flags.seeded && this.tickCounter(battle, "seeded"))
        );
    }

    applyStages(stat: keyof VolatileStats, negative: boolean) {
        this.v.stats[stat] = Math.floor(
            (this.base.stats[stat] * stageMultipliers[this.v.stages[stat]]) / 100
        );
        // https://www.smogon.com/rb/articles/rby_mechanics_guide#stat-mechanics
        if (negative) {
            this.v.stats[stat] %= 1024;
        } else {
            this.v.stats[stat] = clamp(this.v.stats[stat], 1, 999);
        }
    }
}

export type VolatileFlag = (typeof volatileFlags)[number];

export const volatileFlags = ["light_screen", "reflect", "mist", "focus", "seeded"] as const;

export type VolatileStats = Volatiles["stats"];

class Volatiles {
    readonly stages = { atk: 0, def: 0, spc: 0, spe: 0, acc: 0, eva: 0 };
    stats;
    types: Type[];
    flags: Partial<Record<VolatileFlag, boolean>> = {};
    substitute = 0;
    confusion = 0;
    lastDamage = 0;
    counter = 1;
    flinch = false;
    invuln = false;
    handledStatus = false;
    hazed = false;
    trapped = false;
    lastMove?: Move;
    lastMoveIndex?: number;
    charging?: Move;
    recharge?: Move;
    thrashing?: { move: Move; turns: number; acc?: number };
    bide?: { move: Move; turns: number; dmg: number };
    disabled?: { turns: number; indexInMoves: number };
    mimic?: { move: MoveId; indexInMoves: number };
    trapping?: { move: Move; turns: number; dmg: number };

    constructor(base: Pokemon) {
        this.types = [...base.species.types];
        this.stats = {
            atk: base.stats.atk,
            def: base.stats.def,
            spc: base.stats.spc,
            spe: base.stats.spe,
        };
    }

    lockedIn() {
        return (
            this.recharge ||
            this.charging ||
            this.thrashing?.move ||
            this.bide?.move ||
            this.trapping?.move
        );
    }
}
