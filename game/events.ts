import type { BooleanFlag, Stages } from "./battle";
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
    | ConfusionEvent
    | InfoEvent;

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
    why: "attacked" | "substitute" | "recoil" | "drain" | "explosion" | "crash" | "ohko";
    eff?: number;
};

type HitSubstituteEvent = {
    type: "hit_sub";
    src: PlayerId;
    target: PlayerId;
    broken: boolean;
    eff?: number;
};

export type FailReason =
    | "immune"
    | "miss"
    | "generic"
    | "has_substitute"
    | "cant_substitute"
    | "flinch"
    | "mist"
    | "splash"
    | "whirlwind";

type FailureEvent = {
    type: "failed";
    src: PlayerId;
    why: FailReason;
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
};

type StagesEvent = {
    type: "stages";
    id: PlayerId;
    stages: [Stages, number][];
};

type ConfusionEvent = {
    type: "confusion";
    id: PlayerId;
};

type InfoEvent = {
    type: "info";
    id: PlayerId;
    why: BooleanFlag | "conversion";
};
