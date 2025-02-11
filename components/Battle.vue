<template>
  <div
    class="flex h-full p-4 rounded-lg dark:divide-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 shadow space-x-4"
  >
    <div class="flex flex-col" v-if="hasLoaded">
      <div class="flex flex-row-reverse">
        <template v-for="id in battlers">
          <div v-if="id === perspective && players[id].active">
            <div class="h-28"></div>
            <ActivePokemon
              :poke="players[id].active"
              :base="id === myId ? activeInTeam : undefined"
              back
            />
          </div>
          <div v-else-if="players[id].active">
            <div class="flex justify-end p-2">
              <!-- i < players[id].nPokemon | UIcon dies with double ternary for some reason -->
              <UIcon
                v-for="(_, i) in players[id].nPokemon"
                :name="
                  i < players[id].nPokemon - players[id].nFainted
                    ? 'ic:baseline-catching-pokemon'
                    : 'tabler:pokeball-off'
                "
                class="size-5 bg-primary dark:bg-gray-200"
              />
              <UIcon
                v-for="_ in 6 - players[id].nPokemon"
                name="ci:dot-03-m"
                class="size-5 bg-primary dark:bg-gray-200"
              />
            </div>

            <ActivePokemon :poke="players[id].active" />
          </div>
        </template>
      </div>

      <UDivider class="pb-2" />

      <template v-if="options && !selectionText.length">
        <div class="grid grid-cols-[1fr,1.5fr] gap-2 items-center">
          <div class="flex flex-col gap-2">
            <template v-for="(option, i) in options.moves">
              <MoveButton v-if="option.display" :option="option" @click="() => selectMove(i)" />
            </template>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <SwitchButton
              v-for="(poke, i) in myTeam"
              :poke="poke"
              :disabled="i === activeIndex || !options.canSwitch"
              :active="i === activeIndex"
              @click="() => selectSwitch(i)"
            />
          </div>
        </div>
      </template>
      <div class="cancel" v-else-if="options">
        <div class="italic">{{ selectionText }}...</div>
        <UButton @click="cancelMove" color="red">Cancel</UButton>
      </div>
      <template v-else-if="!victor">
        <div v-if="!isBattler">
          <!-- TODO: re-render textbox contents on switch sides -->
          <UButton @click="switchSide" :disabled="true">Switch Side</UButton>
        </div>
        <div v-else class="italic">Waiting for opponent...</div>
      </template>
      <div v-else>
        <div>{{ victor === myId ? "You" : players[victor].name }} Won!</div>
        <UButton to="/">Go Home</UButton>
      </div>
    </div>

    <Textbox :players="players" :perspective="perspective" ref="textbox" />
    <audio ref="sfxController"></audio>
  </div>
</template>

<script setup lang="ts">
import type { Player, Turn } from "../game/battle";
import type { Pokemon } from "../game/pokemon";
import { moveList } from "../game/moveList";
import type { Textbox } from "#build/components";
import type { JoinRoomResponse } from "../server/utils/gameServer";
import { clamp, randChoice } from "../game/utils";
import { speciesList, type SpeciesId } from "~/game/species";
import type { BattleEvent } from "~/game/events";

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
const sfxController = ref<HTMLAudioElement>();
const currentTrack = useCurrentTrack();
const sfxVol = useSfxVolume();
const victor = ref<string>();

effect(() => {
  if (sfxController.value) {
    sfxController.value.volume = sfxVol.value ?? 1.0;
  }
});

let sequenceNo = 0;
onMounted(async () => {
  if (import.meta.server) {
    return;
  }

  if (allMusicTracks.length) {
    currentTrack.value = allMusicTracks[Math.floor(Math.random() * allMusicTracks.length)];
  }

  for (const { isSpectator, id, name, nPokemon } of props.init.players) {
    players[id] = { name, isSpectator, connected: true, nPokemon, nFainted: 0 };
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

  $conn.on("userJoin", (roomId, name, id, isSpectator, nPokemon) => {
    if (roomId === props.room) {
      players[id] = { name, isSpectator, nPokemon, connected: true, nFainted: 0 };
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

onUnmounted(() => {
  currentTrack.value = undefined;
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

  const playSound = (path: string, speed = 1.0) => {
    sfxController.value!.src = path;
    sfxController.value!.play();
    sfxController.value!.playbackRate = speed;
  };

  const playCry = (speciesId: SpeciesId, speed = 1.0) => {
    const track = speciesList[speciesId].dexId.toString().padStart(3, "0");
    playSound(`/effects/cries/${track}.wav`, speed);
  };

  const playDmg = (eff: number) => {
    const track = eff > 1 ? "supereffective" : eff < 1 ? "ineffective" : "neutral";
    playSound(`/effects/${track}.mp3`);
  };

  const handleEvent = (e: BattleEvent) => {
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

      if (live) {
        playCry(e.speciesId);
      }
    } else if (e.type === "damage" || e.type === "recover") {
      players[e.target].active!.hp = e.hpAfter;
      if (e.target === myId.value) {
        activeInTeam.value!.hp = e.hpAfter;
      }

      if (
        live &&
        e.type === "damage" &&
        (e.why === "attacked" || e.why === "confusion" || e.why === "ohko" || e.why === "trap")
      ) {
        playDmg(e.why === "ohko" || !e.eff ? 1 : e.eff);

        if (e.hpAfter === 0) {
          sfxController.value!.onended = () => {
            playCry(players[e.target].active!.speciesId, 0.9);
            sfxController.value!.onended = null;
          };
        }
      }

      if (e.hpAfter === 0) {
        players[e.target].nFainted++;
        console.log("nfainted for ", e.target);
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
    } else if (e.type === "victory") {
      victor.value = e.id;
    } else if (e.type === "hit_sub" && live) {
      playDmg(e.eff ?? 1);
    }
  };

  if (textbox.value) {
    await nextTick();
    await textbox.value.enterTurn(turn, live, handleEvent);
  }

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
