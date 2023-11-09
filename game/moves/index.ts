import type { ActivePokemon, Battle } from "../battle";
import { randRangeInclusive, checkAccuracy } from "../utils";
import { Move } from "./move";

export class ConversionMove extends Move {
    constructor() {
        super("Conversion", 30, "normal");
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        user.types.length = 0;
        user.types.push(...target.types);

        battle.pushEvent({
            type: "info",
            id: target.owner.id,
            why: "conversion",
        });

        return false;
    }
}

export class Psywave extends Move {
    constructor() {
        super("Psywave", 15, "psychic", 80);
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (!checkAccuracy(this.acc!, battle, user, target)) {
            return false;
        }

        // psywave has a desync glitch that we don't emulate
        return target.inflictDamage(
            randRangeInclusive(1, Math.max(Math.floor(user.base.level * 1.5 - 1), 1)),
            user,
            battle,
            false,
            "attacked"
        ).dead;
    }
}

export class Substitute extends Move {
    constructor() {
        super("Substitute", 10, "normal");
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
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

        const { dead } = user.inflictDamage(hp, user, battle, false, "substitute");
        user.substitute = hp + 1;
        return dead;
    }
}

export class MirrorMove extends Move {
    constructor() {
        super("Mirror Move", 20, "flying");
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (!target.lastMove || target.lastMove === this) {
            battle.pushEvent({
                type: "failed",
                src: user.owner.id,
                why: "generic",
            });
            return false;
        }

        target.lastMove.use(battle, user);
        return target.lastMove.execute(battle, user, target);
    }
}

export * from "./bflag";
export * from "./confusion";
export * from "./damaging";
export * from "./fail";
export * from "./recovery";
export * from "./stage";
export * from "./status";
export * from "./move";
