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
                        :back="id === perspective"
                    />
                </template>
            </div>

            <Textbox
                class="textbox"
                :players="players"
                :myId="myId"
                :perspective="perspective"
                ref="textbox"
            />
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
            <template v-else-if="!isBattler">
                <!-- TODO: re-render textbox contents on switch sides -->
                <button @click="switchSide" :disabled="true">Switch Side</button>
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
import type { JoinRoomResponse } from "../server/utils/gameServer";
import { randChoice } from "../game/utils";

const { $conn } = useNuxtApp();
const props = defineProps<{ init: JoinRoomResponse; room: string }>();
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
const perspective = ref<string>("");
const isBattler = ref(false);

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
        }
    }

    isBattler.value = battlers.value.includes(myId.value);
    setPerspective(isBattler.value ? myId.value : randChoice(battlers.value));

    hasLoaded.value = true;

    for (const turn of props.init.turns) {
        await runTurn(turn, false, props.init.choices);
    }

    $conn.on("nextTurn", async (roomId, turn, choices) => {
        if (roomId === props.room) {
            await runTurn(turn, true, choices);
        }
    });
});

const selectMove = (index: number) => {
    selectionText.value = `${players[myId.value].active!.name} will use ${
        moveList[choices.value!.moves[index].move].name
    }`;

    $conn.emit("choose", props.room, { type: "move", index }, currentTurn, err => {
        // TODO: do something with the error
    });
};

const selectSwitch = (to: number) => {
    selectionText.value = `${players[myId.value].active!.name} will be replaced by ${
        myTeam.value[to].name
    }`;
    nextActive = to;
    $conn.emit("choose", props.room, { type: "switch", to }, currentTurn, err => {
        // TODO: do something with the error
    });
};

const cancelMove = () => {
    selectionText.value = "";
    nextActive = activeIndex.value;
    $conn.emit("cancel", props.room, currentTurn, err => {
        // TODO: do something with the error
    });
};

const setPerspective = (id: string) => {
    perspective.value = id;
    battlers.value.sort((a, _) => (a !== perspective.value ? -1 : 1));
};

const switchSide = () => {
    setPerspective(battlers.value.find(pl => pl !== perspective.value)!);
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
        if (battlers.value.includes(myId.value)) {
            players[myId.value].active!.stats = e.stats;
        }
    } else if (e.type === "transform") {
        const target = players[e.target].active!;
        players[e.src].active!.transformed = target.transformed ?? target.speciesId;
    } else if (e.type === "info") {
        if (e.why === "wake" || e.why === "thaw" || e.why === "haze") {
            players[e.id].active!.status = null;
        }
    }
};

const runTurn = async ({ events, turn }: Turn, _live: boolean, newChoices?: Player["choices"]) => {
    choices.value = undefined;
    selectionText.value = "";
    currentTurn = turn + 1;

    await nextTick();
    await textbox.value!.enterTurn(pushToTextbox => {
        for (const e of events) {
            pushToTextbox(e);
            processEvent(e);
        }
    });

    choices.value = newChoices;
    if (newChoices) {
        for (const { pp, indexInMoves } of newChoices.moves) {
            if (indexInMoves !== undefined) {
                activeInTeam.value!.pp[indexInMoves] = pp;
            }
        }
    }
};
</script>
