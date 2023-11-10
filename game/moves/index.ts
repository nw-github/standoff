import type { ActivePokemon, Battle } from "../battle";
import type { Type } from "../utils";
import { Move } from "./move";

export class UniqueMove extends Move {
    executeFn: (
        this: UniqueMove,
        battle: Battle,
        user: ActivePokemon,
        target: ActivePokemon
    ) => boolean;

    constructor({
        name,
        pp,
        type,
        acc,
        priority,
        power,
        execute,
    }: {
        name: string;
        pp: number;
        type: Type;
        acc?: number;
        priority?: number;
        power?: number;
        execute: UniqueMove["executeFn"];
    }) {
        super(name, pp, type, acc, priority, power);
        this.executeFn = execute;
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        return this.executeFn.call(this, battle, user, target);
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
