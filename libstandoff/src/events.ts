import { type Move } from "./move";
import { Status } from "./pokemon";

export type BattleEvent =
    | InitEvent
    | SwitchEvent
    | DamageEvent
    | FailureEvent
    | UseMoveEvent
    | VictoryEvent;

export type PlayerId = number;

type InitEvent = {
    type: "init";
    me: PlayerId;
    opponent: { id: PlayerId; name: string };
};

type SwitchEvent = {
    type: "switch";
    src: PlayerId;
    dexId: number;
    hp: number;
    maxHp: number;
    status: Status | null;
    name: string;
};

type DamageEvent = {
    type: "damage";
    src: PlayerId;
    target: PlayerId;
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
    eff: number;
    isCrit: boolean;
};

type FailureEvent = {
    type: "failed";
    src: PlayerId;
    why: "immune" | "miss";
};

type UseMoveEvent = {
    type: "move";
    src: PlayerId;
    move: Move;
};

type VictoryEvent = {
    type: "victory";
    id: PlayerId;
};
