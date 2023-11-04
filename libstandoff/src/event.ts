import { type Player, type FieldPokemon } from "./battle";
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
    src: FieldPokemon;
    target: FieldPokemon;
    hpBefore: number;
    hpAfter: number;
    eff: number;
    isCrit: boolean;
};

type FailureEvent = {
    type: "failed";
    src: FieldPokemon;
    why: "immune" | "miss";
};

type UseMoveEvent = {
    type: "move";
    src: FieldPokemon;
    move: Move;
};

type VictoryEvent = {
    type: "victory";
    player: Player;
};
