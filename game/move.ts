import type { ActivePokemon, Battle, Stages } from "./battle";
import type { Status } from "./pokemon";
import { randChance255, randRangeInclusive, typeChart, type Type, floatTo255 } from "./utils";

export interface Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly acc?: number;
    readonly priority?: number;

    use?(battle: Battle, user: ActivePokemon): void;
    execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

type Effect = Status | [Stages, number][] | "confusion";

export class DamagingMove implements Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly power: number;
    readonly acc?: number;
    readonly priority?: number;
    readonly highCrit?: true;
    readonly effect?: [number, Effect];
    readonly recoil?: number;
    readonly drain?: true;

    constructor({
        name,
        pp,
        type,
        power,
        acc,
        priority,
        highCrit,
        effect,
        recoil,
        drain,
    }: {
        name: string;
        pp: number;
        type: Type;
        power: number;
        acc?: number;
        priority?: number;
        effect?: [number, Effect];
        highCrit?: true;
        recoil?: number;
        drain?: true;
    }) {
        this.name = name;
        this.pp = pp;
        this.type = type;
        this.power = power;
        this.acc = acc;
        this.priority = priority;
        this.highCrit = highCrit;
        this.effect = effect;
        this.recoil = recoil;
        this.drain = drain;
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
            return false;
        }

        const isCrit = randChance255(this.critChance(user));
        const isSpecial = DamagingMove.isSpecial(this.type);
        const isStab = user.types.includes(this.type);
        const atk = user.getStat(isSpecial ? "spc" : "atk", isCrit);
        const def = target.getStat(isSpecial ? "spc" : "def", isCrit);
        const lvl = user.base.level;

        let dmg = (((2 * lvl * (isCrit ? 2 : 1)) / 5 + 2) * this.power * (atk / def)) / 50 + 2;
        dmg *= isStab ? 1.5 : 1;
        dmg *= eff;

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
                [damage, dead] = user.inflictDamage(
                    Math.max(Math.floor(damage / this.recoil), 1),
                    user,
                    battle,
                    false,
                    "recoil",
                    true
                );
            }

            if (this.drain) {
                user.inflictDamage(
                    -Math.max(Math.floor(damage / 2), 1),
                    target,
                    battle,
                    false,
                    "drain",
                    true
                );
            }
        }

        if (dead || brokeSub) {
            return dead;
        }

        if (!hadSubstitute) {
            this.processEffect(battle, target);
        }

        return dead;
    }

    private processEffect(battle: Battle, target: ActivePokemon) {
        if (!this.effect) {
            return;
        }

        const [chance, effect] = this.effect;
        if (!randChance255(floatTo255(chance))) {
            return;
        }

        if (Array.isArray(effect)) {
            target.inflictStages(effect, battle);
        } else if (effect === "confusion") {
            if (target.confusion !== 0) {
                return;
            }

            target.inflictConfusion(battle);
        } else {
            if (!target.base.status || target.types.includes(this.type)) {
                return;
            }

            target.inflictStatus(effect, battle);
        }
    }

    private critChance(user: ActivePokemon) {
        const baseSpeed = user.base.species.stats.spe;
        if (this.highCrit) {
            return user.focus ? 4 * (baseSpeed / 4) : 8 * (baseSpeed / 2);
        } else {
            return user.focus ? baseSpeed / 8 : baseSpeed / 2;
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
    megadrain: new DamagingMove({
        name: "Mega Drain",
        pp: 10,
        type: "grass",
        power: 40,
        acc: 100,
        drain: true,
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
