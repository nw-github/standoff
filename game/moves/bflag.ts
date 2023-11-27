import type { ActivePokemon, Battle, VolatileFlag } from "../battle";
import { Move } from "./move";
import type { Type } from "../utils";

export class VolatileFlagMove extends Move {
    readonly flag: VolatileFlag;

    constructor({
        name,
        pp,
        type,
        flag,
        acc,
    }: {
        name: string;
        pp: number;
        type: Type;
        flag: VolatileFlag;
        acc?: number;
    }) {
        super(name, pp, type, acc);
        this.flag = flag;
    }

    override execute(battle: Battle, user: ActivePokemon): boolean {
        if (user.v.flags[this.flag]) {
            battle.pushEvent({
                type: "info",
                id: user.owner.id,
                why: "fail_generic",
            });
        } else {
            user.v.flags[this.flag] = true;
            battle.pushEvent({
                type: "info",
                id: user.owner.id,
                why: this.flag,
            });
        }
        return false;
    }
}
