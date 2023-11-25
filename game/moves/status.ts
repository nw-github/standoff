import type { ActivePokemon, Battle } from "../battle";
import { Move } from "./move";
import type { Status } from "../pokemon";
import { getEffectiveness, type Type } from "../utils";

export class StatusMove extends Move {
    readonly status: Status;

    constructor({
        name,
        pp,
        type,
        acc,
        status,
    }: {
        name: string;
        pp: number;
        type: Type;
        status: Status;
        acc?: number;
    }) {
        super(name, pp, type, acc);
        this.status = status;
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (target.substitute && this.status !== "par" && this.status !== "slp") {
            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "fail_generic",
            });
            return false;
        }

        if (
            (this.type === "electric" && getEffectiveness(this.type, target.types) === 0) ||
            (this.type === "poison" && target.types.includes("poison"))
        ) {
            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "immune",
            });
            return false;
        }

        if (this.status === "slp" && target.recharge) {
            // https://www.youtube.com/watch?v=x2AgAdQwyGI
            target.inflictStatus(this.status, battle, true);
            return false;
        }

        if (!this.checkAccuracy(battle, user, target)) {
            return false;
        }

        if (!target.inflictStatus(this.status, battle)) {
            battle.pushEvent({
                type: "info",
                id: target.owner.id,
                why: "fail_generic",
            });
        }
        return false;
    }
}
