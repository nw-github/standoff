import type { ActivePokemon, Battle } from "../battle";
import type { Type } from "../utils";
import { Move } from "./move";

export class UniqueMove extends Move {
    executeFn: (
        this: UniqueMove,
        battle: Battle,
        user: ActivePokemon,
        target: ActivePokemon,
    ) => ReturnType<Move["execute"]>;

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

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon) {
        return this.executeFn.call(this, battle, user, target);
    }
}
