<template>
    <main>
        <h1>Status: {{ status }}</h1>
        <ul>
            <li v-for="(player, id) in players">
                <template v-if="id === myId">(Me) </template>
                {{ player.name }}: {{ id }} {{ player.isSpectator ? "(spectator)" : "" }}
            </li>
        </ul>
        <div class="game">
            <div class="battlefield" v-if="hasStarted">
                <ActivePokemon
                    v-for="id in battlers"
                    :poke="players[id].active!"
                    :base="id === myId ? activeInTeam : undefined"
                />
            </div>

            <div class="textbox">
                <template v-for="[turnNo, turn] in turns">
                    <h2>Turn {{ turnNo }}</h2>
                    <ul>
                        <li v-for="event in turn">
                            {{ event }}
                        </li>
                    </ul>
                </template>

                <div ref="textboxScrollDiv"></div>
            </div>
        </div>

        <div class="selections">
            <template v-if="choices && !selectionText.length">
                <div class="moves">
                    <MoveButton
                        class="move-button"
                        v-for="(choice, i) in choices.moves"
                        :choice="choice"
                        @click="() => selectMove(i)"
                    />
                </div>

                <div class="team">
                    <SwitchButton
                        class="switch-button"
                        v-for="(poke, i) in myTeam"
                        :poke="poke"
                        :disabled="i === activeIndex || !choices.canSwitch"
                        @click="() => selectSwitch(i)"
                    />
                </div>
            </template>
            <template v-else-if="choices">
                <div class="selection-text">{{ selectionText }}...</div>
                <button @click="cancelMove">Cancel</button>
            </template>
        </div>
    </main>
</template>

<style scoped>
main {
    padding: 10px;
}

.game {
    display: flex;
}

.textbox {
    height: 60vh;
    width: 70vw;
    overflow-y: auto;
    background-color: #ccc;
}

.selection-text {
    font-style: italic;
}

.selections {
    display: flex;
}

.moves {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.move-button, .switch-button {
    padding: 5px;
}
</style>

<script setup lang="ts">
import type { BattleEvent } from "../game/events";
import type { ActivePokemon, Player } from "../game/battle";
import type { Pokemon } from "../game/pokemon";
import { moveList } from "../game/moveList";

const status = ref("loading...");
const myId = ref("");
const battlers = ref<string[]>([]);
const players = reactive<Record<string, ClientPlayer>>({});
const turns = ref<[number, string[]][]>([]);
const choices = ref<Player["choices"] | undefined>();
const selectionText = ref("");
const myTeam = ref<Pokemon[]>([]);
const activeIndex = ref(0);
const activeInTeam = computed<Pokemon | undefined>(() => myTeam.value[activeIndex.value]);
const hasStarted = ref(false);

const textboxScrollDiv = ref<HTMLDivElement | null>(null);

const addBattler = (id: string) => {
    if (!battlers.value.includes(id)) {
        battlers.value.push(id);
        battlers.value.sort((a, _) => (a !== myId.value ? -1 : 1));
    }
};

let currentTurn: number;
let nextActive: number = 0;
let ws: WebSocket;
onMounted(() => {
    if (process.server) {
        return;
    }

    const loc = window.location;
    const port = import.meta.env.DEV ? 1337 : loc.port;
    ws = new WebSocket(`${loc.protocol.replace("http", "ws")}//${loc.hostname}:${port}/ws`);
    ws.onopen = () => {
        status.value = "Opened, sending join request...!";

        ws.send(
            wsStringify<ClientMessage>({
                type: "cl_join",
                name: "Player" + Math.round(Math.random() * 10000),
            })
        );
    };
    ws.onmessage = async ({ data }) => {
        const resp = JSON.parse(data) as ServerMessage;
        if (resp.type === "sv_accepted") {
            status.value = `Accepted!`;
            myId.value = resp.id;
            for (const key in players) {
                delete players[key];
            }

            if (resp.team) {
                myTeam.value = resp.team;
                addBattler(resp.id);
            }
            for (const { id, name, isSpectator } of resp.players) {
                players[id] = { name, isSpectator };
                if (!isSpectator) {
                    addBattler(id);
                }
            }
        } else if (resp.type === "sv_join") {
            players[resp.id] = resp;
            if (!resp.isSpectator) {
                addBattler(resp.id);
            }
        } else if (resp.type === "sv_leave") {
            delete players[resp.id];
        } else if (resp.type === "sv_turn") {
            turns.value = [...turns.value, [resp.turn, stringifyEvents(JSON.parse(resp.events))]];
            choices.value = resp.choices;
            selectionText.value = "";
            currentTurn = resp.turn + 1;
            hasStarted.value = true;

            if (resp.choices) {
                for (const { pp, indexInMoves } of resp.choices.moves) {
                    if (indexInMoves !== undefined) {
                        activeInTeam.value!.pp[indexInMoves] = pp;
                    }
                }
            }

            await nextTick();
            textboxScrollDiv.value?.scrollIntoView();
        } else if (resp.type === "sv_cancel") {
            console.log(resp.error);
        } else if (resp.type === "sv_choice") {
            console.log(resp.error);
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
        choices.value = undefined;
        selectionText.value = "";
        battlers.value.length = 0;
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
    selectionText.value = `${players[myId.value].active!.name} will use ${
        moveList[choices.value!.moves[index].move].name
    }`;
};

const selectSwitch = (index: number) => {
    ws.send(
        wsStringify<ClientMessage>({
            type: "cl_choice",
            choice: {
                type: "switch",
                to: index,
                turn: currentTurn,
            },
        })
    );
    selectionText.value = `${players[myId.value].active!.name} will be replaced by ${
        myTeam.value[index].name
    }`;
    nextActive = index;
};

const cancelMove = () => {
    ws.send(
        wsStringify<ClientMessage>({
            type: "cl_cancel",
            turn: currentTurn,
        })
    );
    selectionText.value = "";
    nextActive = activeIndex.value;
};

const stringifyEvents = (events: BattleEvent[]) => {
    const res: string[] = [];
    for (const e of events) {
        stringifyEvent(players, myId.value, e, res);
        if (e.type === "switch") {
            const player = players[e.src];
            player.active = { ...e };
            if (e.src === myId.value) {
                if (activeInTeam.value?.status === "tox") {
                    activeInTeam.value.status = "psn";
                }

                activeIndex.value = nextActive;
                player.active.stats = { ...activeInTeam.value!.stats };
            }
        } else if (e.type === "damage") {
            players[e.target].active!.hp = e.hpAfter;
            if (e.target === myId.value) {
                activeInTeam.value!.hp = e.hpAfter;
            }

            if (e.why === "rest") {
                players[e.target].active!.status = "slp";
            }
        } else if (e.type === "status") {
            // TODO: remove status
            players[e.id].active!.status = e.status;
            if (e.id === myId.value) {
                players[e.id].active!.stats = e.stats;
            }
        } else if (e.type === "stages") {
            players[myId.value].active!.stats = e.stats;
        } else if (e.type === "transform") {
            const target = players[e.target].active!;
            players[e.src].active!.transformed = target.transformed ?? target.speciesId;
        }
    }
    return res;
};
</script>
