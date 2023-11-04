import type { FieldPokemon, Battle } from "./battle";
import type { Type } from "./pokemon";
import { randChance255, randRangeInclusive, typeChart } from "./utils";

export interface Move {
    readonly name: string;
    readonly pp: number;
    readonly type: Type;
    readonly acc?: number;
    readonly priority?: number;

    execute(battle: Battle, user: FieldPokemon, target: FieldPokemon): boolean;
}

export class DamagingMove implements Move {
    constructor(
        readonly name: string,
        readonly pp: number,
        readonly type: Type,
        readonly power: number,
        readonly acc?: number,
        readonly priority?: number,
        readonly highCrit?: true,
    ) {}

    execute(battle: Battle, user: FieldPokemon, target: FieldPokemon): boolean {
        // https://bulbapedia.bulbagarden.net/wiki/Damage#Generation_I
        const eff = DamagingMove.getEffectiveness(this.type, target.base.species.types);
        if (eff === 0) {
            battle.events.push({
                type: "failed",
                src: target,
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
            battle.events.push({
                type: "failed",
                src: user,
                why: "miss",
            });
            return false;
        }

        const rand = dmg === 1 ? 255 : randRangeInclusive(217, 255);
        dmg = Math.trunc(dmg * (rand / 255));

        const hpBefore = target.base.hp;
        target.base.hp = Math.max(target.base.hp - dmg, 0);

        battle.events.push({
            type: "damage",
            src: user,
            hpAfter: target.base.hp,
            hpBefore,
            target,
            eff,
            isCrit,
        });

        if (target.base.hp === 0) {
            return true;
        }

        // TODO: status effects, stat drops, etc.
        return false;
    }

    private critChance(user: FieldPokemon) {
        let baseSpeed = user.base.species.stats.spe;
        if (this.highCrit) {
            return user.focus ? 4 * (baseSpeed / 4) : 8 * (baseSpeed / 2);
        } else {
            return user.focus ? baseSpeed / 8 : baseSpeed / 2;
        }
    }

    private static getEffectiveness(atk: Type, def: Type[]) {
        let eff = 1;
        for (const type of def) {
            eff *= typeChart[atk][type] ?? 1;
        }
        return eff;
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
