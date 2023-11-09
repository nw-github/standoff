<template>
    <div>
        <h1>Status: {{ status }}</h1>
        <ul>
            <li v-for="(player, id) in players">
                <span v-if="id === myId">(Me) </span>
                {{ player.name }}: {{ id }} {{ player.isSpectator ? "(spectator)" : "" }}
            </li>
        </ul>

        <div v-if="selectedMove === -1 && validMoves" v-for="{ move, i } in validMoves.moves">
            <button @click="() => selectMove(i)">{{ moveList[move].name }}</button>
        </div>
        <button @click="cancelMove" v-else-if="selectedMove !== -1 && validMoves">Cancel</button>

        <div v-for="[turnNo, turn] in turns">
            <h2>Turn {{ turnNo }}</h2>
            <ul>
                <li v-for="event in turn">
                    {{ event }}
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { BattleEvent } from "../game/events";
import type { Player, Stages } from "../game/battle";
import type { Status } from "../game/pokemon";
import { moveList } from "../game/move";
import { hpPercent } from "~/game/utils";

type ClientPlayer = {
    name: string;
    isSpectator: boolean;
    active?: {
        dexId: number;
        name: string;
        hp: number;
        status: Status | null;
    };
};

const status = ref("loading...");
const myId = ref("");
const players = reactive<Record<string, ClientPlayer>>({});
const turns = ref<[number, string[]][]>([]);
const validMoves = ref<ReturnType<Player["validMoves"]> | null>(null);
const selectedMove = ref<number>(-1);

let currentTurn: number;
let ws: WebSocket;
onMounted(() => {
    if (process.server) {
        return;
    }

    const loc = window.location;
    ws = new WebSocket(`${loc.protocol.replace("http", "ws")}//${loc.host}/ws`);
    ws.onopen = () => {
        status.value = "Opened, sending join request...!";

        ws.send(
            wsStringify<ClientMessage>({
                type: "cl_join",
                name: "Player" + Math.round(Math.random() * 10000),
            })
        );
    };
    ws.onmessage = ({ data }) => {
        const resp = JSON.parse(data) as ServerMessage;
        if (resp.type === "sv_accepted") {
            status.value = `Accepted!`;
            myId.value = resp.id;
            for (const key in players) {
                delete players[key];
            }
            for (const { id, name, isSpectator } of resp.players) {
                players[id] = { name, isSpectator };
            }
        } else if (resp.type === "sv_join") {
            players[resp.id] = resp;
        } else if (resp.type === "sv_leave") {
            delete players[resp.id];
        } else if (resp.type === "sv_turn") {
            turns.value = [...turns.value, [resp.turn, stringifyEvents(JSON.parse(resp.events))]];
            validMoves.value = resp.validMoves ?? null;
            selectedMove.value = -1;
            currentTurn = resp.turn + 1;
        }
    };
    ws.onerror = console.error;
    ws.onclose = () => {
        status.value = "Connection to server closed!";
        myId.value = "";
        for (const key in players) {
            delete players[key];
        }
        turns.value = [];
        validMoves.value = null;
        selectedMove.value = -1;
    };
});

onUnmounted(() => {
    ws.close();
});

const selectMove = (index: number) => {
    ws.send(
        wsStringify<ClientMessage>({
            type: "cl_choice",
            choice: {
                type: "move",
                index,
                turn: currentTurn,
            },
        })
    );
    selectedMove.value = index;
};

const cancelMove = () => {
    ws.send(
        wsStringify<ClientMessage>({
            type: "cl_cancel",
            turn: currentTurn,
        })
    );
    selectedMove.value = -1;
};

const stringifyEvents = (events: BattleEvent[]) => {
    const res = [];
    for (const e of events) {
        if (e.type === "switch") {
            const player = players[e.src];
            if (player.active) {
                res.push(`${player.name} withdrew ${player.active.name}!`);
            }

            player.active = { ...e };
            res.push(`${player.name} sent in ${e.name}! (${e.hp}/${e.maxHp})`);
        } else if (e.type === "damage") {
            const src = players[e.src].active!;
            const target = players[e.target].active!;

            let { hpBefore, hpAfter } = e;
            if (e.target === myId.value) {
                hpBefore = hpPercent(hpBefore, e.maxHp);
                hpAfter = hpPercent(hpAfter, e.maxHp);
            }

            if (e.why === "recoil") {
                res.push(`${src.name} was hurt by recoil!`);
            } else if (e.why === "drain") {
                res.push(`${src.name} had it's energy drained!`);
            } else if (e.why === "crash") {
                res.push(`${src.name} kept going and crashed!`);
            }

            if (e.why !== "explosion") {
                const diff = hpBefore - hpAfter;
                res.push(
                    `${target.name} ${diff < 0 ? "gained" : "lost"} ${Math.abs(
                        diff
                    )}% of its health. (${hpAfter}% remaining)`
                );
            }

            if (e.why === "substitute") {
                res.push(`${src.name} put in a substitute!`);
            } else if (e.why === "attacked") {
                if (e.isCrit) {
                    res.push(` - A critical hit!`);
                }
                const eff = e.eff ?? 1;
                if (eff !== 1) {
                    res.push(` - It's ${eff > 1 ? "supereffective!" : "not very effective..."}`);
                }
            } else if (e.why === "ohko") {
                res.push(` - It's a one-hit KO!`);
            }

            if (hpAfter === 0) {
                res.push(`${target.name} fainted!`);
            }
        } else if (e.type === "failed") {
            const src = players[e.src].active!;
            switch (e.why) {
                case "immune":
                    res.push(`It doesn't affect ${src.name}...`);
                    break;
                case "miss":
                    res.push(`${src.name} missed!`);
                    break;
                case "cant_substitute":
                    res.push(`${src.name} doesn't have enough HP to create a substitute!`);
                    break;
                case "has_substitute":
                    res.push(`${src.name} already has a substitute!`);
                    break;
                case "whirlwind":
                case "generic":
                    res.push(`But it failed!`);
                    break;
                case "flinch":
                    res.push(`${src.name} flinched!`);
                    break;
                case "mist":
                    res.push(`${src.name} is protected by the mist!`);
                    break;
                case "splash":
                    res.push(`No effect!`);
                    break;
            }
        } else if (e.type === "move") {
            res.push(`${players[e.src].active!.name} used ${e.move}!`);
        } else if (e.type === "victory") {
            res.push(`${players[e.id].name} wins!`);
        } else if (e.type === "hit_sub") {
            res.push(`${players[e.target].active!.name}'s substitute took the hit!`);
            if (e.broken) {
                res.push(`${players[e.target].active!.name}'s substitute broke!`);
            }

            const eff = e.eff ?? 1;
            if (eff !== 1) {
                res.push(` - It's ${eff > 1 ? "super effective!" : "not very effective..."}`);
            }
        } else if (e.type === "status") {
            const table: Record<Status, string> = {
                psn: "was poisoned",
                par: "was paralyzed",
                slp: "fell asleep",
                frz: "was frozen",
                tox: "was badly poisoned",
            };

            res.push(`${players[e.id].active!.name} ${table[e.status]}!`);
        } else if (e.type === "stages") {
            const table: Record<Stages, string> = {
                atk: "Attack",
                def: "Defense",
                spc: "Special",
                spe: "Speed",
                acc: "Accuracy",
                eva: "Evasion",
            };

            for (const [stage, amount] of e.stages) {
                res.push(
                    `${players[e.id].active!.name}'s ${table[stage]} ${
                        amount > 0 ? "rose" : "fell"
                    }${Math.abs(amount) > 1 ? " sharply" : ""}!`
                );
            }
        } else if (e.type === "confusion") {
            res.push(`${players[e.id].active!.name} became confused!`);
        } else if (e.type === "flag") {
            if (e.flag === "light_screen") {
                res.push(`${players[e.id].active!.name}'s protected against special attacks!`);
            } else if (e.flag === "reflect") {
                res.push(`${players[e.id].active!.name} is gained armor!`);
            } else if (e.flag === "mist") {
                res.push(`${players[e.id].active!.name}'s' shrouded in mist!`);
            } else if (e.flag === "focus") {
                res.push(`${players[e.id].active!.name} is getting pumped!`);
            }
        } else {
            res.push(JSON.stringify(e));
        }
    }
    return res;
};
</script>
