import type { ActivePokemon, Battle } from "../battle";
import { Move } from "./move";
import { type Type } from "../utils";

export class ConfusionMove extends Move {
    constructor({ name, pp, type, acc }: { name: string; pp: number; type: Type; acc?: number }) {
        super(name, pp, type, acc);
    }

    override execute(battle: Battle, user: ActivePokemon, target: ActivePokemon): boolean {
        if (target.substitute) {
            battle.pushEvent({
                type: "failed",
                src: target.owner.id,
                why: "generic",
            });
            return false;
        }

        if (!this.checkAccuracy(battle, user, target)) {
            return false;
        }

        if (!target.inflictConfusion(battle)) {
            battle.pushEvent({
                type: "failed",
                src: target.owner.id,
                why: "generic",
            });
        }
        return false;
    }
}
