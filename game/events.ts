import { type Status } from "./pokemon";

export type BattleEvent =
    | SwitchEvent
    | DamageEvent
    | FailureEvent
    | UseMoveEvent
    | VictoryEvent
    | HitSubstituteEvent;

export type PlayerId = string;

type SwitchEvent = {
    type: "switch";
    src: PlayerId;
    dexId: number;
    hp: number;
    maxHp: number;
    status: Status | null;
    name: string;
};

export type DamageEvent = {
    type: "damage";
    src: PlayerId;
    target: PlayerId;
    hpBefore: number;
    hpAfter: number;
    maxHp: number;
    isCrit: boolean;
    why: "attacked" | "substitute";
    eff?: number;
};

type HitSubstituteEvent = {
    type: "hit_sub";
    src: PlayerId;
    target: PlayerId;
    broken: boolean;
};

type FailureEvent = {
    type: "failed";
    src: PlayerId;
    why: "immune" | "miss" | "generic" | "has_substitute" | "cant_substitute";
};

type UseMoveEvent = {
    type: "move";
    src: PlayerId;
    move: string;
};

type VictoryEvent = {
    type: "victory";
    id: PlayerId;
};