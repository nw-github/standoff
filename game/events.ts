import type { Stages } from "./battle";
import { type Status } from "./pokemon";

export type BattleEvent =
    | SwitchEvent
    | DamageEvent
    | FailureEvent
    | UseMoveEvent
    | VictoryEvent
    | HitSubstituteEvent
    | StatusEvent
    | StagesEvent
    | ConfusionEvent;

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
    why: "attacked" | "substitute" | "recoil";
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

type StatusEvent = {
    type: "status";
    id: PlayerId;
    status: Status;
}

type StagesEvent = {
    type: "stages";
    id: PlayerId;
    stages: [Stages, number][];
}

type ConfusionEvent = {
    type: "confusion";
    id: PlayerId;
}
