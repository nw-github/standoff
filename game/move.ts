import type { ActivePokemon, Battle } from "./battle";
import { randChance255, randRangeInclusive, typeChart, type Type } from "./utils";

export interface Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly acc?: number;
    readonly priority?: number;

    use?(battle: Battle, user: ActivePokemon): void;
    execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

export class DamagingMove implements Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly power: number;
    readonly acc?: number;
    readonly priority?: number;
    readonly highCrit?: true;

    constructor({
        name,
        pp,
        type,
        power,
        acc,
        priority,
        highCrit,
    }: {
        name: string;
        pp: number;
        type: Type;
        power: number;
        acc?: number;
        priority?: number;
        highCrit?: true;
    }) {
        this.name = name;
        this.pp = pp;
        this.type = type;
        this.power = power;
        this.acc = acc;
        this.priority = priority;
        this.highCrit = highCrit;
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
        const hasSubstitute = target.substitute !== 0;
        const dead = target.dealDamage(
            Math.trunc(dmg * (rand / 255)),
            user,
            battle,
            isCrit,
            "attacked",
            eff
        );
        if (dead || (hasSubstitute && target.substitute === 0)) {
            return dead;
        }

        // TODO: status effects, stat drops, etc.
        return dead;
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
    earthquake: new DamagingMove({
        name: "Earthquake",
        pp: 10,
        type: "ground",
        power: 100,
        acc: 100,
    }),
    quickattack: new DamagingMove({
        name: "Quick Attack",
        pp: 40,
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

            const dead = user.dealDamage(hp, user, battle, false, "substitute");
            user.substitute = hp + 1;
            return dead;
        },
    }),
};
