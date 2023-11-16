import type { Choice, Player, SelectionError, Turn } from "../../game/battle";
import type { PlayerId } from "../../game/events";
import type { Pokemon } from "../../game/pokemon";

export type LoginResponse = {
    id: string; 
    rooms: string[];
}

export type JoinRoomResponse = {
    team?: Pokemon[];
    choices?: Player["choices"];
    players: { id: string; name: string; isSpectator: boolean }[];
    turns: Turn[];
};

export interface ClientMessage {
    getRooms: (ack: (rooms: string[]) => void) => void;
    login: (name: string, ack: (resp: LoginResponse | "bad_username") => void) => void;
    enterMatchmaking: (team: Pokemon[], ack: (err?: "must_login" | "invalid_team") => void) => void;
    joinRoom: (roomId: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
}

export interface ServerMessage {
    foundMatch: (roomId: string) => void;
}

type ChoiceRequest = {
    type: "cl_choice";
    choice: Choice;
};

type CancelRequest = {
    type: "cl_cancel";
    turn: number;
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
