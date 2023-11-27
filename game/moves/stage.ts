import type { ActivePokemon, Battle } from "../battle";
import { Move } from "./move";
import { type Stages, type Type } from "../utils";

export class StageMove extends Move {
    readonly stages: [Stages, number][];

    constructor({
        name,
        pp,
        type,
        acc,
        stages,
    }: {
        name: string;
        pp: number;
        type: Type;
        stages: StageMove["stages"];
        acc?: number;
    }) {
        super(name, pp, type, acc);
        this.stages = stages;
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (this.acc) {
            if (target.v.flags.mist || target.v.substitute) {
                battle.pushEvent({
                    type: "info",
                    id: target.owner.id,
                    why: target.v.flags.mist ? "mist_protect" : "fail_generic",
                });
                return false;
            }

            if (!this.checkAccuracy(battle, user, target)) {
                return false;
            }
        } else {
            target = user;
        }

        if (!target.inflictStages(user.owner, this.stages, battle)) {
            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "fail_generic",
            });
        }
        return false;
    }
}
