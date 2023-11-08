import type { ActivePokemon, Battle, Stages } from "./battle";
import type { Status } from "./pokemon";
import { randChance255, randRangeInclusive, typeChart, type Type, floatTo255, checkAccuracy } from "./utils";

export interface Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly acc?: number;
    readonly priority?: number;

    use?(battle: Battle, user: ActivePokemon): void;
    execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

type Effect = Status | [Stages, number][] | "confusion" | "flinch";
type Flag = "high_crit" | "drain" | "explosion" | "recharge" | "crash";

export class DamagingMove implements Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly power: number;
    readonly flag?: Flag;
    readonly acc?: number;
    readonly priority?: number;
    readonly effect?: [number, Effect];
    readonly recoil?: number;

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
    }) {
        this.name = name;
        this.pp = pp;
        this.type = type;
        this.power = power;
        this.acc = acc;
        this.priority = priority;
        this.flag = flag;
        this.effect = effect;
        this.recoil = recoil;
    }

    execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        // https://bulbapedia.bulbagarden.net/wiki/Damage#Generation_I
        const eff = DamagingMove.getEffectiveness(this.type, target.base.species.types);
        if (eff === 0) {
            battle.pushEvent({
                type: "failed",
                src: target.owner.id,
                why: "immune",
            });
            this.crashDamage(battle, user, target);
            return false;
        }

        if (this.acc && !checkAccuracy(this.acc, battle, user, target)) {
            this.crashDamage(battle, user, target);
            return false;
        }

        const isCrit = randChance255(this.critChance(user));
        const isSpecial = DamagingMove.isSpecial(this.type);
        const isStab = user.types.includes(this.type);
        const [atks, defs] = (isSpecial ? ["spc", "spc"] : ["atk", "def"]) as [Stages, Stages];
        const atk = user.getStat(atks, isCrit);
        const def = Math.floor(target.getStat(defs, isCrit) / (this.flag === "explosion" ? 2 : 1));
        const lvl = user.base.level;
        const crit = isCrit ? 2 : 1;
        const stab = isStab ? 1.5 : 1;
        const dmg = ((((2 * lvl * crit) / 5 + 2) * this.power * (atk / def)) / 50 + 2) * stab * eff;
        if (dmg === 0) {
            battle.pushEvent({
                type: "failed",
                src: user.owner.id,
                why: "miss",
            });
            return false;
        }

        const rand = dmg === 1 ? 255 : randRangeInclusive(217, 255);
        const hadSubstitute = target.substitute !== 0;
        let [damage, dead] = target.inflictDamage(
            Math.trunc(dmg * (rand / 255)),
            user,
            battle,
            isCrit,
            "attacked",
            false,
            eff
        );
        const brokeSub = hadSubstitute && target.substitute === 0;
        if (!brokeSub) {
            if (this.recoil) {
                [, dead] = user.inflictDamage(
                    Math.max(Math.floor(damage / this.recoil), 1),
                    user,
                    battle,
                    false,
                    "recoil",
                    true
                );
            }

            if (this.flag === "drain") {
                user.inflictDamage(
                    -Math.max(Math.floor(damage / 2), 1),
                    target,
                    battle,
                    false,
                    "drain",
                    true
                );
            }

            if (this.flag === "explosion") {
                [, dead] = user.inflictDamage(user.base.hp, user, battle, false, "explosion", true);
            }
        }

        if (dead || brokeSub) {
            return dead;
        }

        if (this.flag === "recharge") {
            user.recharge = this;
        }

        if (!hadSubstitute && this.effect) {
            const [chance, effect] = this.effect;
            if (!randChance255(floatTo255(chance))) {
                return dead;
            }

            if (Array.isArray(effect)) {
                target.inflictStages(effect, battle);
            } else if (effect === "confusion") {
                if (target.confusion !== 0) {
                    return dead;
                }

                target.inflictConfusion(battle);
            } else if (effect === "flinch") {
                target.flinch = battle.turn;
            } else {
                if (!target.base.status || target.types.includes(this.type)) {
                    return dead;
                }

                target.inflictStatus(effect, battle);
            }
        }

        return dead;
    }

    private critChance(user: ActivePokemon) {
        const baseSpeed = user.base.species.stats.spe;
        if (this.flag === "high_crit") {
            return user.focus ? 4 * (baseSpeed / 4) : 8 * (baseSpeed / 2);
        } else {
            return user.focus ? baseSpeed / 8 : baseSpeed / 2;
        }
    }

    private crashDamage(battle: Battle, user: ActivePokemon, target: ActivePokemon) {
        if (this.flag === "crash") {
            // https://www.smogon.com/dex/rb/moves/high-jump-kick/
            if (user.substitute && target.substitute) {
                target.inflictDamage(1, user, battle, false, "attacked");
            } else if (!user.substitute) {
                user.inflictDamage(1, user, battle, false, "crash", true);
            }
        }
    }

    private static getEffectiveness(atk: Type, def: Type[]) {
        return def.reduce((eff, def) => eff * (typeChart[atk][def] ?? 1), 1);
    }

    private static isSpecial(atk: Type) {
        switch (atk) {
            case "normal":
            case "rock":
            case "ground":
            case "ghost":
            case "poison":
            case "bug":
            case "flying":
            case "fight":
                return false;
            case "water":
            case "grass":
            case "fire":
            case "electric":
            case "ice":
            case "psychic":
            case "dragon":
                return true;
        }
    }
}

export type MoveId = keyof typeof moveList;

const tsEnsureMove = <T extends Move>(t: T) => t;

export const moveList = {
    bodyslam: new DamagingMove({
        name: "Body Slam",
        pp: 15,
        type: "normal",
        power: 85,
        acc: 100,
        effect: [30.1, "par"],
    }),
    crabhammer: new DamagingMove({
        name: "Crabhammer",
        pp: 10,
        type: "water",
        power: 90,
        acc: 85,
        flag: "high_crit",
    }),
    doubleedge: new DamagingMove({
        name: "Double Edge",
        pp: 15,
        type: "normal",
        power: 100,
        acc: 100,
        recoil: 4, // 1 / 4
    }),
    earthquake: new DamagingMove({
        name: "Earthquake",
        pp: 10,
        type: "ground",
        power: 100,
        acc: 100,
    }),
    explosion: new DamagingMove({
        name: "Explosion",
        pp: 5,
        type: "normal",
        power: 170,
        acc: 100,
        flag: "explosion",
    }),
    headbutt: new DamagingMove({
        name: "Headbutt",
        pp: 15,
        type: "normal",
        power: 70,
        acc: 100,
        effect: [30.1, "flinch"],
    }),
    hijumpkick: new DamagingMove({
        name: "Hi Jump Kick",
        pp: 20,
        type: "fight",
        power: 85,
        acc: 90,
        flag: "crash"
    }),
    hyperbeam: new DamagingMove({
        name: "Hyper Beam",
        pp: 5,
        type: "normal",
        power: 150,
        acc: 90,
        flag: "recharge",
    }),
    jumpkick: new DamagingMove({
        name: "Jump Kick",
        pp: 25,
        type: "fight",
        power: 70,
        acc: 95,
        flag: "crash"
    }),
    megadrain: new DamagingMove({
        name: "Mega Drain",
        pp: 10,
        type: "grass",
        power: 40,
        acc: 100,
        flag: "drain",
    }),
    psybeam: new DamagingMove({
        name: "Psybeam",
        pp: 20,
        type: "psychic",
        power: 65,
        acc: 100,
        effect: [10.2, "confusion"],
    }),
    psychic: new DamagingMove({
        name: "Psychic",
        pp: 10,
        type: "psychic",
        power: 90,
        acc: 100,
        effect: [33.2, [["spc", -1]]],
    }),
    quickattack: new DamagingMove({
        name: "Quick Attack",
        pp: 30,
        type: "normal",
        power: 40,
        acc: 100,
        priority: +1,
    }),
    selfdestruct: new DamagingMove({
        name: "Self-Destruct",
        pp: 5,
        type: "normal",
        power: 130,
        acc: 100,
        flag: "explosion",
    }),
    substitute: tsEnsureMove({
        name: "Substitute",
        pp: 10,
        type: "normal",
        execute(battle: Battle, user: ActivePokemon, _: ActivePokemon) {
            if (user.substitute > 0) {
                battle.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "has_substitute",
                });
                return false;
            }

            const hp = Math.floor(user.base.stats.hp / 4);
            // Gen 1 bug, if you have exactly 25% hp you can create a substitute and instantly die
            if (hp > user.base.hp) {
                battle.pushEvent({
                    type: "failed",
                    src: user.owner.id,
                    why: "cant_substitute",
                });
                return false;
            }

            const [__, dead] = user.inflictDamage(hp, user, battle, false, "substitute");
            user.substitute = hp + 1;
            return dead;
        },
    }),
};
