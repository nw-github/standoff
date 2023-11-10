import type { ActivePokemon, Battle } from "../battle";
import { moveListToId } from "../moveList";
import type { Type } from "../utils";

export abstract class Move {
    constructor(
        readonly name: string,
        readonly pp: number,
        readonly type: Type,
        readonly acc?: number,
        readonly priority?: number,
        readonly power?: number,
    ) {}

    use(battle: Battle, user: ActivePokemon, target: ActivePokemon, moveIndex?: number): boolean {
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
                    move: moveListToId.get(this)!,
                    disabled: true,
                });
                return false;
            }
        }

        if (moveIndex) {
            user.base.pp[moveIndex] = Math.max(user.base.pp[moveIndex] - 1, 0);
        }

        battle.pushEvent({
            type: "move",
            src: user.owner.id,
            move: moveListToId.get(this)!,
            thrashing: user.thrashing ? true : undefined,
        });
        user.lastMove = this;
        return this.execute(battle, user, target);
    }

    protected abstract execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

