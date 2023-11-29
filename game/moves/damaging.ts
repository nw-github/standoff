import type { ActivePokemon, Battle } from "../battle";
import { Move } from "./move";
import type { Status } from "../pokemon";
import {
    floatTo255,
    getEffectiveness,
    randChance255,
    randRangeInclusive,
    isSpecial,
    calcDamage,
    type Type,
    type Stages,
    randChoiceWeighted,
} from "../utils";

type Effect = Status | [Stages, number][] | "confusion" | "flinch";
type Flag =
    | "high_crit"
    | "drain"
    | "explosion"
    | "recharge"
    | "crash"
    | "double"
    | "multi"
    | "dream_eater"
    | "payday"
    | "charge"
    | "charge_invuln"
    | "multi_turn"
    | "rage"
    | "trap"
    | "level"
    | "ohko"
    | "counter"
    | "super_fang";

export class DamagingMove extends Move {
    readonly flag?: Flag;
    readonly effect?: [number, Effect];
    readonly recoil?: number;
    readonly dmg?: number;

    constructor({
        name,
        pp,
        type,
        power,
        acc,
        priority,
        effect,
        recoil,
        flag,
        dmg,
    }: {
        name: string;
        pp: number;
        type: Type;
        power: number;
        acc?: number;
        priority?: number;
        effect?: [number, Effect];
        recoil?: number;
        flag?: Flag;
        dmg?: number;
    }) {
        super(name, pp, type, acc, priority, power);
        this.flag = flag;
        this.effect = effect;
        this.recoil = recoil;
        this.dmg = dmg;
    }

    override use(battle: Battle, user: ActivePokemon, target: ActivePokemon, moveIndex?: number) {
        if ((this.flag === "charge" || this.flag === "charge_invuln") && user.v.charging !== this) {
            battle.event({ type: "charge", id: user.owner.id, move: battle.moveIdOf(this)! });
            user.v.charging = this;
            if (this.flag === "charge_invuln") {
                user.v.invuln = true;
            }

            return false;
        }

        user.v.charging = undefined;
        user.v.trapping = undefined;
        target.v.lastDamage = 0;
        if (this.flag === "charge_invuln") {
            user.v.invuln = false;
        }
        return super.use(battle, user, target, moveIndex);
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon) {
        if (this.flag === "multi_turn" && !user.v.thrashing) {
            user.v.thrashing = { move: this, turns: randRangeInclusive(2, 3) };
        } else if (user.v.thrashing && user.v.thrashing.turns !== -1) {
            if (--user.v.thrashing.turns === 0) {
                user.v.thrashing = undefined;
                user.confuse(battle, true);
            }
        }

        if (this.flag === "trap") {
            target.v.recharge = undefined;
        }

        const { dmg, isCrit, eff } = this.getDamage(user, target);
        if (dmg === 0 || !this.checkAccuracy(battle, user, target)) {
            if (dmg === 0) {
                if (eff === 0) {
                    battle.info(target, "immune");
                    if (this.flag === "trap") {
                        this.trapTarget(user, target, dmg);
                    }
                } else {
                    battle.info(user, "miss");
                }

                if (this.flag === "crash" && eff === 0) {
                    return false;
                }
            }

            if (this.flag === "crash") {
                // https://www.smogon.com/dex/rb/moves/high-jump-kick/
                if (user.v.substitute && target.v.substitute) {
                    target.damage(1, user, battle, false, "attacked");
                } else if (!user.v.substitute) {
                    return user.damage(1, user, battle, false, "crash", true).dead;
                }
            } else if (this.flag === "explosion") {
                // according to showdown, explosion also boosts rage even on miss/failure
                target.handleRage(battle);
                return user.damage(user.base.hp, user, battle, false, "explosion", true).dead;
            }

            return false;
        }

        if (this.flag === "rage") {
            user.v.thrashing = { move: this, turns: -1 };
        } else if (this.flag === "trap") {
            this.trapTarget(user, target, dmg);
        }

        const hadSub = target.v.substitute !== 0;
        let { dealt, brokeSub, dead, event } = target.damage(
            dmg,
            user,
            battle,
            isCrit,
            this.flag === "ohko" ? "ohko" : "attacked",
            false,
            eff
        );

        if (this.flag === "multi" || this.flag === "double") {
            event.hitCount = 1;
        }

        if (!brokeSub) {
            if (this.recoil) {
                dead =
                    user.damage(
                        Math.max(Math.floor(dealt / this.recoil), 1),
                        user,
                        battle,
                        false,
                        "recoil",
                        true
                    ).dead || dead;
            }

            if (this.flag === "drain" || this.flag === "dream_eater") {
                user.recover(Math.max(Math.floor(dealt / 2), 1), target, battle, "drain");
            } else if (this.flag === "explosion") {
                dead =
                    user.damage(user.base.hp, user, battle, false, "explosion", true).dead || dead;
            } else if (this.flag === "double" || this.flag === "multi") {
                const count = this.flag === "double" ? 2 : DamagingMove.multiHitCount();
                for (let hits = 1; !dead && !brokeSub && hits < count; hits++) {
                    event.hitCount = 0;
                    ({ dead, brokeSub, event } = target.damage(
                        dmg,
                        user,
                        battle,
                        isCrit,
                        "attacked",
                        false,
                        eff
                    ));
                    event.hitCount = hits + 1;
                }
            } else if (this.flag === "payday") {
                battle.info(user, "payday");
            }
        }

        if (dead || brokeSub) {
            return dead;
        }

        if (this.flag === "recharge") {
            user.v.recharge = this;
        }

        if (this.effect) {
            const [chance, effect] = this.effect;
            if (effect === "brn" && target.base.status === "frz") {
                target.base.status = undefined;
                target.v.hazed = true;
                battle.info(target, "thaw");
                // TODO: can you thaw and then burn?
                return dead;
            }

            if (!randChance255(floatTo255(chance))) {
                return dead;
            }

            if (effect === "confusion") {
                if (target.v.confusion === 0) {
                    target.confuse(battle);
                }
                return dead;
            } else if (hadSub) {
                return dead;
            } else if (Array.isArray(effect)) {
                target.modStages(user.owner, effect, battle);
            } else if (effect === "flinch") {
                target.v.flinch = true;
            } else {
                if (target.base.status || target.v.types.includes(this.type)) {
                    return dead;
                }

                target.status(effect, battle);
            }
        }

        return dead;
    }

    private getDamage(user: ActivePokemon, target: ActivePokemon) {
        // https://bulbapedia.bulbagarden.net/wiki/Damage#Generation_I
        const eff = getEffectiveness(this.type, target.v.types);
        if (this.flag === "dream_eater" && target.base.status !== "slp") {
            return { dmg: 0, isCrit: false, eff: 1 };
        } else if (this.flag === "level") {
            return { dmg: user.base.level, isCrit: false, eff: 1 };
        } else if (this.flag === "ohko") {
            const targetIsFaster = target.getStat("spe") > user.getStat("spe");
            return {
                dmg: targetIsFaster || eff === 0 ? 0 : 65535,
                isCrit: false,
                eff,
            };
        } else if (this.flag === "counter") {
            return { dmg: this.counterDamage(user, target), isCrit: false, eff: 1 };
        } else if (this.flag === "super_fang") {
            return { dmg: Math.max(Math.floor(target.base.hp / 2), 1), isCrit: false, eff: 1 };
        } else if (this.dmg) {
            return { dmg: this.dmg, isCrit: false, eff: 1 };
        }

        const baseSpe = user.base.species.stats.spe;
        let chance: number;
        if (this.flag === "high_crit") {
            chance = user.v.flags.focus ? 4 * Math.floor(baseSpe / 4) : 8 * Math.floor(baseSpe / 2);
        } else {
            chance = Math.floor(user.v.flags.focus ? baseSpe / 8 : baseSpe / 2);
        }

        const isCrit = randChance255(chance);
        const [atks, defs] = isSpecial(this.type)
            ? (["spc", "spc"] as const)
            : (["atk", "def"] as const);
        const ls = atks === "spc" && target.v.flags.light_screen;
        const reflect = atks === "atk" && target.v.flags.reflect;
        const explosion = this.flag === "explosion" ? 2 : 1;
        const dmg = calcDamage({
            lvl: user.base.level,
            pow: this.power!,
            crit: isCrit ? 2 : 1,
            atk: user.getStat(atks, isCrit),
            def: Math.floor(target.getStat(defs, isCrit, true, ls || reflect) / explosion),
            stab: user.v.types.includes(this.type) ? 1.5 : 1,
            eff,
        });
        if (dmg === 0) {
            return { dmg: 0, isCrit: false, eff };
        }

        const rand = dmg === 1 ? 255 : randRangeInclusive(217, 255);
        return { dmg: Math.floor((dmg * rand) / 255), isCrit, eff };
    }

    private counterDamage(user: ActivePokemon, target: ActivePokemon) {
        const lastMove = target.v.lastMove;
        if (lastMove) {
            if (lastMove.type !== "normal" && lastMove.type !== "fight") {
                return 0;
            } else if (lastMove === this || !lastMove.power) {
                return 0;
            }
        }

        if (target.owner.choice?.move === this) {
            return 0;
        }

        return user.v.lastDamage * 2;
    }

    private static multiHitCount() {
        return randChoiceWeighted([2, 3, 4, 5], [37.5, 37.5, 12.5, 12.5]);
    }

    private trapTarget(user: ActivePokemon, target: ActivePokemon, dmg: number) {
        const turns = DamagingMove.multiHitCount() - 1;
        target.v.trapped = true;
        user.v.trapping = { move: this, turns, dmg };
    }
}
