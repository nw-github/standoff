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

    use(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (user.disabled) {
            if (--user.disabled.turns === 0) {
                user.disabled = undefined;
                battle.pushEvent({
                    type: "disable",
                    id: user.owner.id,
                });
            } else if (this === user.disabled?.move) {
                battle.pushEvent({
                    type: "move",
                    src: user.owner.id,
                    move: this.name, // FIXME: send an ID instead, this prevents localization
                    disabled: true,
                });
                return false;
            }
        }

        battle.pushEvent({
            type: "move",
            src: user.owner.id,
            move: this.name, // FIXME: send an ID instead, this prevents localization
            disabled: false
        });
        user.lastMove = this;
        return this.execute(battle, user, target);
    }

    protected abstract execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

