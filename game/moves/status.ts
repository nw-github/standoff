import type { ActivePokemon, Battle } from "../battle";
import { Move } from "./move";
import type { Status } from "../pokemon";
import { checkAccuracy, type Type } from "../utils";

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
        if (this.acc && !checkAccuracy(this.acc, battle, user, target)) {
            return false;
        }

        if (!target.inflictStatus(this.status, battle)) {
            battle.pushEvent({
                type: "failed",
                src: target.owner.id,
                why: "generic",
            });
        }
        return false;
    }
}
