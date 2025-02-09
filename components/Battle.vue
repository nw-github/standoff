<template>
  <UCard>
    <div class="flex">
      <div class="flex flex-col" v-if="hasLoaded">
        <div class="flex flex-row-reverse justify-center">
          <template v-for="id in battlers">
            <ActivePokemon
              v-if="players[id].active"
              :poke="players[id].active!"
              :base="id === myId ? activeInTeam : undefined"
              :back="id === perspective"
            />
          </template>
        </div>

        <div class="flex">
          <template v-if="options && !selectionText.length">
            <div class="flex flex-col p-2 gap-2">
              <template v-for="(option, i) in options.moves">
                <MoveButton
                  class="move-button"
                  v-if="option.display"
                  :option="option"
                  @click="() => selectMove(i)"
                />
              </template>
            </div>

            <div class="grid grid-cols-2 p-2 gap-2 test">
              <SwitchButton
                v-for="(poke, i) in myTeam"
                :poke="poke"
                :disabled="i === activeIndex || !options.canSwitch"
                @click="() => selectSwitch(i)"
              />
            </div>
          </template>
          <div class="cancel" v-else-if="options">
            <div class="italic">{{ selectionText }}...</div>
            <UButton @click="cancelMove" color="red">Cancel</UButton>
          </div>
          <template v-else-if="!isBattler">
            <!-- TODO: re-render textbox contents on switch sides -->
            <UButton @click="switchSide" :disabled="true">Switch Side</UButton>
          </template>
          <template v-else>
            <div class="italic">Waiting for opponent...</div>
          </template>
        </div>
      </div>

      <Textbox class="textbox" :players="players" :perspective="perspective" ref="textbox" />
    </div>
  </UCard>

  <ul>
    <li v-for="({ name, isSpectator, connected }, id) in players">
      <template v-if="id === myId">(Me) </template>
      {{ name }}: {{ id }} {{ isSpectator ? "(spectator)" : "" }}
      {{ !connected ? "(disconnected)" : "" }}
    </li>
  </ul>
</template>

<style scoped>
.textbox {
  width: min(100%, 600px);
  height: 60vh;
  border-radius: 0.5rem;
}
</style>

<script setup lang="ts">
import type { Player, Turn } from "../game/battle";
import type { Pokemon } from "../game/pokemon";
import { moveList } from "../game/moveList";
import type { Textbox } from "#build/components";
import type { JoinRoomResponse } from "../server/utils/gameServer";
import { clamp, randChoice } from "../game/utils";

const { $conn } = useNuxtApp();
const props = defineProps<{ init: JoinRoomResponse; room: string }>();
const myId = useMyId();
const battlers = ref<string[]>([]);
const players = reactive<Record<string, ClientPlayer>>({});
const options = ref<Player["options"]>();
const selectionText = ref("");
const myTeam = ref<Pokemon[]>(props.init.team ?? []);
const activeIndex = ref(0);
const activeInTeam = computed<Pokemon | undefined>(() => myTeam.value[activeIndex.value]);
const textbox = ref<InstanceType<typeof Textbox>>();
const hasLoaded = ref(false);
const perspective = ref<string>("");
const isBattler = ref(false);

let sequenceNo = 0;
onMounted(async () => {
  if (process.server) {
    return;
  }

  for (const { isSpectator, id, name } of props.init.players) {
    players[id] = { name, isSpectator, connected: true };
    if (!isSpectator && !battlers.value.includes(id)) {
      battlers.value.push(id);
    }
  }

  isBattler.value = battlers.value.includes(myId.value);
  setPerspective(isBattler.value ? myId.value : randChoice(battlers.value));

  hasLoaded.value = true;

  for (const turn of props.init.turns) {
    await runTurn(turn, false, props.init.options);
  }

  $conn.on("nextTurn", async (roomId, turn, options) => {
    if (roomId === props.room) {
      await runTurn(turn, true, options);
    }
  });

  $conn.on("userJoin", (roomId, name, id, isSpectator) => {
    if (roomId === props.room) {
      players[id] = { name, isSpectator, connected: true };
    }
  });

  $conn.on("userLeave", (roomId, id) => {
    if (roomId === props.room) {
      if (!(id in battlers)) {
        delete players[id];
      } else {
        players[id].connected = false;
      }
    }
  });

  $conn.on("userDisconnect", (roomId, id) => {
    if (roomId === props.room) {
      players[id].connected = false;
    }
  });
});

const selectMove = (index: number) => {
  selectionText.value = `${players[myId.value].active!.name} will use ${
    moveList[options.value!.moves[index].move].name
  }`;

  $conn.emit("choose", props.room, index, "move", sequenceNo, err => {
    // TODO: do something with the error
  });
};

const selectSwitch = (index: number) => {
  selectionText.value = `${players[myId.value].active!.name} will be replaced by ${
    myTeam.value[index].name
  }`;
  $conn.emit("choose", props.room, index, "switch", sequenceNo, err => {
    // TODO: do something with the error
  });
};

const cancelMove = () => {
  selectionText.value = "";
  $conn.emit("cancel", props.room, sequenceNo, err => {
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

const runTurn = async (turn: Turn, live: boolean, newOptions?: Player["options"]) => {
  options.value = undefined;
  selectionText.value = "";
  sequenceNo++;

  await nextTick();
  await textbox.value!.enterTurn(turn, live, e => {
    if (e.type === "switch") {
      const player = players[e.src];
      player.active = { ...e, stages: {} };
      if (e.src === myId.value) {
        if (activeInTeam.value?.status === "tox") {
          activeInTeam.value.status = "psn";
        }

        activeIndex.value = e.indexInTeam;
        player.active.stats = undefined;
      }
    } else if (e.type === "damage" || e.type === "recover") {
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
        activeInTeam.value!.status = e.status;
      }
    } else if (e.type === "stages") {
      if (battlers.value.includes(myId.value)) {
        players[myId.value].active!.stats = e.stats;
      }

      const active = players[e.id].active!;
      for (const [stat, val] of e.stages) {
        active.stages[stat] = clamp((active.stages[stat] ?? 0) + val, -6, 6);
      }
    } else if (e.type === "transform") {
      const target = players[e.target].active!;
      const src = players[e.src].active!;
      src.transformed = target.transformed ?? target.speciesId;
      src.stages = { ...target.stages };
    } else if (e.type === "info") {
      if (e.why === "haze") {
        for (const player in players) {
          const active = players[player].active;
          if (!active) {
            continue;
          }

          if (player === e.id && active.status === "tox") {
            active.status = "psn";
          } else if (player !== e.id) {
            active.status = undefined;
          }

          active.stages = {};
        }

        if (battlers.value.includes(myId.value)) {
          players[myId.value].active!.stats = undefined;
        }
      } else if (e.why === "wake" || e.why === "thaw") {
        players[e.id].active!.status = undefined;
      }
    } else if (e.type === "conversion") {
      players[e.user].active!.conversion = e.types;
    }
  });

  options.value = newOptions;
  if (newOptions && !players[myId.value].active?.transformed) {
    for (const { pp, indexInMoves } of newOptions.moves) {
      if (indexInMoves !== undefined && pp !== undefined) {
        activeInTeam.value!.pp[indexInMoves] = pp;
      }
    }
  }
};
</script>
