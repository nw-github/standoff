import type { ActivePokemon, Battle } from "../battle";
import type { DamageReason } from "../events";
import { Move } from "./move";
import type { Type } from "../utils";

export class RecoveryMove extends Move {
    readonly why: DamageReason;

    constructor({
        name,
        pp,
        type,
        why,
    }: {
        name: string;
        pp: number;
        type: Type;
        why: DamageReason;
    }) {
        super(name, pp, type);
        this.why = why;
    }

    override execute(battle: Battle, user: ActivePokemon, _: ActivePokemon): boolean {
        const diff = user.base.stats.hp - user.base.hp;
        if (diff === 0 || diff % 255 === 0) {
            battle.pushEvent({
                type: "failed",
                src: user.owner.id,
                why: "generic",
            });
            return false;
        }

        user.inflictDamage(-diff, user, battle, false, this.why, true);
        return false;
    }
}
