import type { ActivePokemon, Battle } from "../battle";
import type { Type } from "../utils";

export abstract class Move {
    constructor(
        readonly name: string,
        readonly pp: number,
        readonly type: Type,
        readonly acc?: number,
        readonly priority?: number
    ) {}

    use(battle: Battle, user: ActivePokemon): void {
        battle.pushEvent({
            type: "move",
            src: user.owner.id,
            move: this.name, // FIXME: send an ID instead, this prevents localization
        });
        user.lastMove = this;
    }

    abstract execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

