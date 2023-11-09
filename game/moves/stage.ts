import type { ActivePokemon, Battle, Stages } from "../battle";
import { Move } from "./move";
import { checkAccuracy, type Type } from "../utils";

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
            if (target.flags.mist) {
                battle.pushEvent({
                    type: "failed",
                    src: target.owner.id,
                    why: "mist",
                });
                return false;
            }

            if (!checkAccuracy(this.acc, battle, user, target)) {
                return false;
            }
        } else {
            target = user;
        }

        if (!target.inflictStages(this.stages, battle)) {
            battle.pushEvent({
                type: "failed",
                src: target.owner.id,
                why: "generic",
            });
        }
        return false;
    }
}
