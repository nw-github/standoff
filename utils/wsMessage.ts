import type { Choice, Player, SelectionError } from "../game/battle";
import type { PlayerId } from "../game/events";
import type { Pokemon } from "../game/pokemon";

export const wsStringify = <T>(t: T) => JSON.stringify(t);

export type ClientMessage = JoinRequest | ChoiceRequest | CancelRequest;
export type ServerMessage =
    | AcceptedResponse
    | JoinResponse
    | LeaveMessage
    | TurnMessage
    | ChoiceResponse
    | CancelResponse;

type JoinRequest = {
    type: "cl_join";
    name: string;
};

type ChoiceRequest = {
    type: "cl_choice";
    choice: Choice;
};

type CancelRequest = {
    type: "cl_cancel";
    turn: number;
};

type AcceptedResponse = {
    type: "sv_accepted";
    id: PlayerId;
    team?: Pokemon[];
    players: { name: string; id: string; isSpectator: boolean }[];
};

type JoinResponse = {
    type: "sv_join";
    id: PlayerId;
    name: string;
    isSpectator: boolean;
};

type LeaveMessage = {
    type: "sv_leave";
    id: PlayerId;
};

type TurnMessage = {
    type: "sv_turn";
    /** JSON encoded BattleEvent[] */
    events: string;
    turn: number;
    choices?: Player["choices"];
};

type ChoiceResponse = {
    type: "sv_choice";
    error?: SelectionError["type"];
};

type CancelResponse = {
    type: "sv_cancel";
    error?: SelectionError["type"];
};
