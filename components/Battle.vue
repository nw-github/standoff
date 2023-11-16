<template>
    <div class="battle">
        <ul>
            <li v-for="({ name, isSpectator }, id) in players">
                <template v-if="id === myId">(Me) </template>
                {{ name }}: {{ id }} {{ isSpectator ? "(spectator)" : "" }}
            </li>
        </ul>
        <div class="game" v-if="hasLoaded">
            <div class="battlefield">
                <template v-for="id in battlers">
                    <ActivePokemon
                        class="pokemon"
                        v-if="players[id].active"
                        :poke="players[id].active!"
                        :base="id === myId ? activeInTeam : undefined"
                    />
                </template>
            </div>

            <Textbox class="textbox" :players="players" :myId="myId" ref="textbox" />
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
    </div>
</template>

<style scoped>
main {
    padding: 10px;
}

.game {
    display: flex;
}

.battlefield {
    min-width: 480px;
    max-width: 480px;
}

.pokemon:first-child {
    margin-left: auto;
}

.pokemon:last-child {
    margin-right: auto;
}

.textbox {
    width: 100%;
    height: 50vh;
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

.move-button,
.switch-button {
    padding: 5px 5px 5px 0px;
}
</style>

<script setup lang="ts">
import type { BattleEvent } from "../game/events";
import type { ActivePokemon, Player, Turn } from "../game/battle";
import type { Pokemon } from "../game/pokemon";
import { moveList } from "../game/moveList";
import type { Textbox } from "#build/components";
import type { JoinRoomResponse } from "../server/utils/gameMessage";

const { $conn } = useNuxtApp();
const props = defineProps<{ init: JoinRoomResponse; room: string; }>();
const myId = useMyId();
const battlers = ref<string[]>([]);
const players = reactive<Record<string, ClientPlayer>>({});
const choices = ref<Player["choices"] | undefined>();
const selectionText = ref("");
const myTeam = ref<Pokemon[]>(props.init.team ?? []);
const activeIndex = ref(0);
const activeInTeam = computed<Pokemon | undefined>(() => myTeam.value[activeIndex.value]);
const textbox = ref<InstanceType<typeof Textbox>>();
const hasLoaded = ref(false);

let currentTurn = 0;
let nextActive = 0;

onMounted(async () => {
    if (process.server) {
        return;
    }

    for (const { isSpectator, id, name } of props.init.players) {
        players[id] = { name, isSpectator };
        if (!isSpectator && !battlers.value.includes(id)) {
            battlers.value.push(id);
            battlers.value.sort((a, _) => (a !== myId.value ? -1 : 1));
        }
    }

    hasLoaded.value = true;

    await nextTick();
    for (const turn of props.init.turns) {
        await displayTurn(turn, false);
    }

    choices.value = props.init.choices;
    if (choices.value) {
        for (const { pp, indexInMoves } of choices.value.moves) {
            if (indexInMoves !== undefined) {
                activeInTeam.value!.pp[indexInMoves] = pp;
            }
        }
    }

    //     ws.onmessage = async ({ data }) => {
    //         if (resp.type === "sv_join") {
    //             players[resp.id] = resp;
    //             if (!resp.isSpectator) {
    //                 addBattler(resp.id);
    //             }
    //         } else if (resp.type === "sv_leave") {
    //             delete players[resp.id];
    //         } else if (resp.type === "sv_cancel") {
    //             console.log(resp.error);
    //         } else if (resp.type === "sv_choice") {
    //             console.log(resp.error);
    //         }
    //     };
    //     ws.onclose = () => {
    //         status.value = "Connection to server closed!";
    //         myId.value = "";
    //         for (const key in players) {
    //             delete players[key];
    //         }
    //         choices.value = undefined;
    //         selectionText.value = "";
    //         battlers.value.length = 0;
    //         textbox.value?.clear();
    //     };
});

const selectMove = (index: number) => {
    // ws.send(
    //     wsStringify<ClientMessage>({
    //         type: "cl_choice",
    //         choice: {
    //             type: "move",
    //             index,
    //             turn: currentTurn,
    //         },
    //     })
    // );
    selectionText.value = `${players[myId.value].active!.name} will use ${
        moveList[choices.value!.moves[index].move].name
    }`;
};

const selectSwitch = (index: number) => {
    // ws.send(
    //     wsStringify<ClientMessage>({
    //         type: "cl_choice",
    //         choice: {
    //             type: "switch",
    //             to: index,
    //             turn: currentTurn,
    //         },
    //     })
    // );
    selectionText.value = `${players[myId.value].active!.name} will be replaced by ${
        myTeam.value[index].name
    }`;
    nextActive = index;
};

const cancelMove = () => {
    // ws.send(
    //     wsStringify<ClientMessage>({
    //         type: "cl_cancel",
    //         turn: currentTurn,
    //     })
    // );
    selectionText.value = "";
    nextActive = activeIndex.value;
};

const processEvent = (e: BattleEvent) => {
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
        players[e.id].active!.status = e.status;
        if (e.id === myId.value) {
            players[e.id].active!.stats = e.stats;
        }
    } else if (e.type === "stages") {
        players[myId.value].active!.stats = e.stats;
    } else if (e.type === "transform") {
        const target = players[e.target].active!;
        players[e.src].active!.transformed = target.transformed ?? target.speciesId;
    } else if (e.type === "info") {
        if (e.why === "wake" || e.why === "thaw" || e.why === "haze") {
            players[e.id].active!.status = null;
        }
    }
};

const displayTurn = async ({ events, turn }: Turn, _live: boolean) => {
    currentTurn = turn + 1;
    await textbox.value!.enterTurn(pushToTextbox => {
        for (const e of events) {
            pushToTextbox(e);
            processEvent(e);
        }
    });
};
</script>
