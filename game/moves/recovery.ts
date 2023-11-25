import type { ActivePokemon, Battle } from "../battle";
import type { RecoveryReason } from "../events";
import { Move } from "./move";
import type { Type } from "../utils";

export class RecoveryMove extends Move {
    readonly why: RecoveryReason;

    constructor({
        name,
        pp,
        type,
        why,
    }: {
        name: string;
        pp: number;
        type: Type;
        why: RecoveryReason;
    }) {
        super(name, pp, type);
        this.why = why;
    }

    override execute(battle: Battle, user: ActivePokemon): boolean {
        const diff = user.base.stats.hp - user.base.hp;
        if (diff === 0 || diff % 255 === 0) {
            battle.pushEvent({
                type: "info",
                id: user.owner.id,
                why: "fail_generic",
            });
            return false;
        }

        if (this.why === "rest") {
            user.inflictRecovery(diff, user, battle, this.why);
            user.base.status = "slp";
            user.base.sleep_turns = 3;
            // In gen 1, Rest doesn't reset the toxic counter or par/brn stat drops
        } else {
            user.inflictRecovery(Math.floor(user.base.stats.hp / 2), user, battle, this.why);
        }
        return false;
    }
}
