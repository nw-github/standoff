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
import { moveList } from "../game/moveList";
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

const pname = (id: string, title: boolean = true) => {
    if (id === myId.value) {
        return players[id].active!.name;
    } else if (title) {
        return `The opposing ${players[id].active!.name}`;
    } else {
        return `the opposing ${players[id].active!.name}`;
    }
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
            const src = pname(e.src);
            const target = pname(e.target);

            let { hpBefore, hpAfter } = e;
            if (e.target === myId.value) {
                hpBefore = hpPercent(hpBefore, e.maxHp);
                hpAfter = hpPercent(hpAfter, e.maxHp);
            }

            if (e.why === "recoil") {
                res.push(`${src} was hurt by recoil!`);
            } else if (e.why === "drain") {
                res.push(`${src} had it's energy drained!`);
            } else if (e.why === "crash") {
                res.push(`${src} kept going and crashed!`);
            } else if (e.why === "recover") {
                res.push(`${src} regained health!`);
            } else if (e.why === "seeded") {
                res.push(`${src}'s health was sapped by Leech Seed!`);
            } else if (e.why === "psn") {
                res.push(`${src} is hurt by poison!`);
            } else if (e.why === "brn") {
                res.push(`${src} is hurt by its burn!`);
            } else if (e.why === "attacked" && e.isCrit) {
                res.push(`A critical hit!`);
            }

            if (e.why !== "explosion") {
                const diff = hpBefore - hpAfter;
                res.push(
                    `- ${target} ${diff < 0 ? "gained" : "lost"} ${Math.abs(
                        diff
                    )}% of its health. (${hpAfter}% remaining)`
                );
            }

            if (e.why === "substitute") {
                res.push(`${src} put in a substitute!`);
            } else if (e.why === "attacked") {
                const eff = e.eff ?? 1;
                if (eff !== 1) {
                    res.push(` - It's ${eff > 1 ? "super effective!" : "not very effective..."}`);
                }
            } else if (e.why === "ohko") {
                res.push(` - It's a one-hit KO!`);
            }

            if (hpAfter === 0) {
                res.push(`${target} fainted!`);
            }
        } else if (e.type === "failed") {
            const src = pname(e.src);
            switch (e.why) {
                case "immune":
                    res.push(`It doesn't affect ${src}...`);
                    break;
                case "miss":
                    res.push(`${src} missed!`);
                    break;
                case "cant_substitute":
                    res.push(`${src} doesn't have enough HP to create a substitute!`);
                    break;
                case "has_substitute":
                    res.push(`${src} already has a substitute!`);
                    break;
                case "whirlwind":
                case "generic":
                    res.push(`But it failed!`);
                    break;
                case "flinch":
                    res.push(`${src} flinched!`);
                    break;
                case "mist":
                    res.push(`${src} is protected by the mist!`);
                    break;
                case "splash":
                    res.push(`No effect!`);
                    break;
            }
        } else if (e.type === "move") {
            res.push(`${pname(e.src)} used ${e.move}!`);
        } else if (e.type === "victory") {
            res.push(`${players[e.id].name} wins!`);
        } else if (e.type === "hit_sub") {
            const target = pname(e.target);
            res.push(`${target}'s substitute took the hit!`);
            if (e.broken) {
                res.push(`${target}'s substitute broke!`);
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
                brn: "was burned",
            };

            res.push(`${pname(e.id)} ${table[e.status]}!`);
        } else if (e.type === "stages") {
            const table: Record<Stages, string> = {
                atk: "Attack",
                def: "Defense",
                spc: "Special",
                spe: "Speed",
                acc: "Accuracy",
                eva: "Evasion",
            };

            const name = pname(e.id);
            for (const [stage, amount] of e.stages) {
                res.push(
                    `${name}'s ${table[stage]} ${amount > 0 ? "rose" : "fell"}${
                        Math.abs(amount) > 1 ? " sharply" : ""
                    }!`
                );
            }
        } else if (e.type === "confusion") {
            res.push(`${pname(e.id)} became confused!`);
        } else if (e.type === "info") {
            if (e.why === "light_screen") {
                res.push(`${pname(e.id)}'s protected against special attacks!`);
            } else if (e.why === "reflect") {
                res.push(`${pname(e.id)} is gained armor!`);
            } else if (e.why === "mist") {
                res.push(`${pname(e.id)}'s' shrouded in mist!`);
            } else if (e.why === "focus") {
                res.push(`${pname(e.id)} is getting pumped!`);
            } else if (e.why === "conversion") {
                res.push(`Converted type to match ${pname(e.id, false)}!`);
            } else if (e.why === "payday") {
                res.push(`Coins scattered everywhere!`);
            } else if (e.why === "seeded") {
                res.push(`${pname(e.id)} was seeded!`);
            }
        } else if (e.type === "transform") {
            res.push(`${pname(e.src)} transformed into ${pname(e.target, false)}!`);
        } else {
            res.push(JSON.stringify(e));
        }
    }
    return res;
};
</script>
