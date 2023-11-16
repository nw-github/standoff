import type { Choice, Player, SelectionError, Turn } from "../../game/battle";
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

export type ChoiceError = SelectionError["type"] | "bad_room" | "not_in_battle";

export interface ClientMessage {
    getRooms: (ack: (rooms: string[]) => void) => void;
    login: (name: string, ack: (resp: LoginResponse | "bad_username") => void) => void;
    enterMatchmaking: (team: Pokemon[], ack: (err?: "must_login" | "invalid_team") => void) => void;
    joinRoom: (room: string, ack: (resp: JoinRoomResponse | "bad_room") => void) => void;
    choose: (room: string, choice: Choice, turn: number, ack: (err?: ChoiceError) => void) => void;
    cancel: (room: string, turn: number, ack: (err?: ChoiceError) => void) => void;
}

export interface ServerMessage {
    foundMatch: (roomId: string) => void;
    nextTurn: (roomId: string, turn: Turn, choices?: Player["choices"]) => void;
}
