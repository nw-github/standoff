import { type Player, type ActivePokemon } from "./battle";
import { type Move } from "./move";
import { type Pokemon } from "./pokemon";

export type Turn = {
    turn: number;
    events: BattleEvent[];
};

export class EventSystem {
    private events: BattleEvent[] = [];

    push(event: BattleEvent) {
        this.events.push(event);
    }

    finish(turn: number): Turn {
        return {
            turn,
            events: this.events.splice(0),
        };
    }
}

export type BattleEvent = SwitchEvent | DamageEvent | FailureEvent | UseMoveEvent | VictoryEvent;

type SwitchEvent = {
    type: "switch";
    src: Pokemon;
    target: Pokemon;
};

type DamageEvent = {
    type: "damage";
    src: ActivePokemon;
    target: ActivePokemon;
    hpBefore: number;
    hpAfter: number;
    eff: number;
    isCrit: boolean;
};

type FailureEvent = {
    type: "failed";
    src: ActivePokemon;
    why: "immune" | "miss";
};

type UseMoveEvent = {
    type: "move";
    src: ActivePokemon;
    move: Move;
};

type VictoryEvent = {
    type: "victory";
    player: Player;
};
