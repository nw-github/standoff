import type { ActivePokemon, Battle } from "../battle";
import type { Type } from "../utils";

export abstract class Move {
    readonly pp: number;

    constructor(
        readonly name: string,
        pp: number,
        readonly type: Type,
        readonly acc?: number,
        readonly priority?: number,
        readonly power?: number,
    ) {
        this.pp = Math.min(Math.floor(pp * 8 / 5), 61);
    }

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
                    move: battle.moveIdOf(this)!,
                    disabled: true,
                });
                return false;
            }
        }

        if (moveIndex !== undefined && !user.thrashing) {
            user.base.pp[moveIndex]--;
            if (user.base.pp[moveIndex] < 0) {
                user.base.pp[moveIndex] = 63;
            }
        }

        battle.pushEvent({
            type: "move",
            src: user.owner.id,
            move: battle.moveIdOf(this)!,
            thrashing: user.thrashing ? true : undefined,
        });
        user.lastMove = this;
        return this.execute(battle, user, target);
    }

    protected abstract execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean;
}

