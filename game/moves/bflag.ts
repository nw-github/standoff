import type { ActivePokemon, Battle, BooleanFlag } from "../battle";
import { Move } from "./move";
import type { Type } from "../utils";

export class BooleanFlagMove extends Move {
    readonly flag: BooleanFlag;

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
        flag: BooleanFlag;
        acc?: number;
    }) {
        super(name, pp, type, acc);
        this.flag = flag;
    }

    override execute(battle: Battle, user: ActivePokemon): boolean {
        if (user.flags[this.flag]) {
            battle.pushEvent({
                type: "info",
                id: user.owner.id,
                why: "fail_generic",
            });
        } else {
            user.flags[this.flag] = true;
            battle.pushEvent({
                type: "info",
                id: user.owner.id,
                why: this.flag,
            });
        }
        return false;
    }
}
