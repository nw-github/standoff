<template>
  <div
    class="flex h-full flex-col sm:flex-row p-4 overflow-auto rounded-lg dark:divide-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 shadow space-x-4"
  >
    <div class="flex flex-col w-full items-center" v-if="hasLoaded">
      <div class="w-full flex justify-end p-2" v-if="opponent">
        <!-- i < players[id].nPokemon | UIcon dies with double ternary for some reason -->
        <UIcon
          v-for="(_, i) in players[opponent].nPokemon"
          :name="
            i < players[opponent].nPokemon - players[opponent].nFainted
              ? 'ic:baseline-catching-pokemon'
              : 'tabler:pokeball-off'
          "
          class="size-5 bg-primary dark:bg-gray-200"
        />
        <UIcon
          v-for="_ in 6 - players[opponent].nPokemon"
          name="ci:dot-03-m"
          class="size-5 bg-primary dark:bg-gray-200"
        />
      </div>

      <div class="flex flex-row-reverse">
        <template v-for="id in battlers">
          <div v-if="id === perspective && players[id].active">
            <div class="h-16"></div>
            <ActivePokemon
              :poke="players[id].active"
              :base="id === myId ? activeInTeam : undefined"
              back
            />
          </div>
          <div v-else-if="players[id].active">
            <ActivePokemon :poke="players[id].active" />
          </div>
        </template>
      </div>

      <div class="relative w-full" v-if="liveEvents.length">
        <div
          class="events absolute w-full flex flex-col bottom-1 p-2 rounded-lg bg-gray-300 dark:bg-gray-700 bg-opacity-90 dark:bg-opacity-90"
        >
          <template v-for="[events, _] in liveEvents">
            <div>
              <component :is="() => events" />
            </div>
          </template>
        </div>
      </div>

      <UDivider class="pb-2" />

      <div class="w-full">
        <template v-if="options && !selectionText.length">
          <div class="grid sm:grid-rows-[1fr,1.5fr] gap-2 sm:grid-cols-[1fr,1.5fr]">
            <div class="flex flex-col gap-1 sm:gap-2">
              <template v-for="(option, i) in options.moves">
                <MoveButton v-if="option.display" :option="option" @click="selectMove(i)" />
              </template>
            </div>

            <div class="grid grid-cols-2 gap-1 sm:gap-2 items-center">
              <SwitchButton
                v-for="(poke, i) in myTeam"
                :poke="poke"
                :disabled="i === activeIndex || !options.canSwitch"
                :active="i === activeIndex"
                @click="selectSwitch(i)"
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
    </div>

    <div class="hidden min-[900px]:block h-full w-full">
      <Textbox
        :players="players"
        :chats="init.chats"
        :turns="turns"
        @chat="sendChat"
        @forfeit="forfeit"
        :victor="victor"
      />
    </div>
    <div class="min-[900px]:hidden p-2 flex justify-end items-start" ref="menuDiv">
      <UChip :show="unseen !== 0" :text="unseen" size="xl">
        <UButton
          icon="heroicons:bars-3-16-solid"
          variant="outline"
          color="gray"
          @click="(slideoverOpen = true), (unseen = 0)"
          ref="menuButton"
        />
      </UChip>

      <USlideover v-model="slideoverOpen">
        <Textbox
          :players="players"
          :chats="init.chats"
          :turns="turns"
          @chat="sendChat"
          @forfeit="forfeit"
          @close="slideoverOpen = false"
          :victor="victor"
          closable
        />
      </USlideover>
    </div>

    <audio ref="sfxController"></audio>
  </div>
</template>

<style scoped>
@import "assets/turn.css";
</style>

<script setup lang="ts">
import type { Options, Turn } from "../game/battle";
import type { Pokemon, Status } from "../game/pokemon";
import type { BattleEvent, InfoReason } from "../game/events";
import { speciesList, type SpeciesId } from "../game/species";
import { clamp, hpPercentExact, randChoice } from "../game/utils";
import { moveList, type MoveId } from "../game/moveList";
import type { JoinRoomResponse } from "../server/utils/gameServer";
import { useElementVisibility, useIntervalFn } from "@vueuse/core";
import { stageTable } from "#imports";

const { $conn } = useNuxtApp();
const props = defineProps<{ init: JoinRoomResponse; room: string }>();
const myId = useMyId();
const battlers = ref<string[]>([]);
const players = reactive<Record<string, ClientPlayer>>({});
const options = ref<Options>();
const selectionText = ref("");
const myTeam = ref<Pokemon[]>(props.init.team ?? []);
const activeIndex = ref(0);
const activeInTeam = computed<Pokemon | undefined>(() => myTeam.value[activeIndex.value]);
const opponent = computed(() => battlers.value.find(v => v != perspective.value));
const hasLoaded = ref(false);
const perspective = ref<string>("");
const isBattler = ref(false);
const sfxController = ref<HTMLAudioElement>();
const currentTrack = useCurrentTrack();
const sfxVol = useSfxVolume();
const victor = ref<string>();
const turns = ref<[VNode[], boolean][]>([]);
const liveEvents = ref<[VNode[], number][]>([]);
const unseen = ref(0);
const menuButton = ref<HTMLElement>();
const isMenuVisible = useElementVisibility(menuButton);
const slideoverOpen = ref(false);

useIntervalFn(() => {
  liveEvents.value = liveEvents.value.filter(ev => Date.now() - ev[1] < 1400);
}, 500);

effect(() => {
  if (sfxController.value) {
    sfxController.value.volume = sfxVol.value ?? 1.0;
  }
});

let sequenceNo = 0;
onMounted(async () => {
  if (allMusicTracks.length) {
    currentTrack.value = randChoice(allMusicTracks);
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
      players[id].connected = false;
    }
  });

  $conn.on("userDisconnect", (roomId, id) => {
    if (roomId === props.room) {
      players[id].connected = false;
    }
  });

  $conn.on("userChat", (roomId, id, message, turn) => {
    if (roomId === props.room) {
      if (!props.init.chats[turn]) {
        props.init.chats[turn] = [];
      }

      props.init.chats[turn].push({ message, player: id });
      if (isMenuVisible.value) {
        unseen.value++;
      }
    }
  });
});

onUnmounted(() => {
  currentTrack.value = undefined;
});

const sendChat = (message: string) => {
  $conn.emit("chat", props.room, message, err => {
    // TODO: do something with the error
  });
};

const forfeit = () => {
  $conn.emit("choose", props.room, 0, "forfeit", sequenceNo, err => {
    // TODO: do something with the error
  });
};

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

const runTurn = async (turn: Turn, live: boolean, newOptions?: Options) => {
  options.value = undefined;
  selectionText.value = "";
  sequenceNo++;

  const playSound = (path: string, speed = 1.0) => {
    if (sfxController.value) {
      sfxController.value.src = path;
      sfxController.value.play();
      sfxController.value.playbackRate = speed;
    }
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

        if (e.hpAfter === 0 && sfxController.value) {
          sfxController.value.onended = () => {
            playCry(players[e.target].active!.speciesId, 0.9);
            sfxController.value!.onended = null;
          };
        }
      }

      if (e.hpAfter === 0) {
        players[e.target].nFainted++;
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

  turns.value.push([[], turn.switchTurn]);
  for (const e of turn.events) {
    const html = htmlForEvent(e);
    turns.value.at(-1)![0].push(...html);

    handleEvent(e);
    if (live) {
      liveEvents.value.push([html, Date.now()]);
      await delay(e.type === "damage" ? 500 : 300);
    }
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const htmlForEvent = (e: BattleEvent) => {
  const text = (s: any, clazz: string = "") => h("p", { class: clazz }, s);
  const bold = (s: any) => h("b", s);
  const italic = (s: any) => h("i", s);
  const pname = (id: string, title = true) => {
    if (id === perspective.value) {
      return players[id].active!.name;
    } else if (title) {
      return `The opposing ${players[id].active!.name}`;
    } else {
      return `the opposing ${players[id].active!.name}`;
    }
  };

  const res: Array<VNode> = [];
  if (e.type === "switch") {
    const player = players[e.src];
    if (player.active && player.active.hp) {
      if (e.src === perspective.value) {
        res.push(text(`Come back! ${player.active.name}!`, "move"));
      } else {
        res.push(text(`${player.name} withdrew ${player.active.name}!`, "move"));
      }
    }

    if (e.src === perspective.value) {
      res.push(text(["Go! ", bold(`${e.name}`), "!"], "move"));
    } else {
      res.push(text([`${player.name} sent in `, bold(`${e.name}`), "!"], "move"));
    }
  } else if (e.type === "damage" || e.type === "recover") {
    const src = pname(e.src);
    const target = pname(e.target);
    const percent = roundTo(Math.abs(hpPercentExact(e.hpBefore - e.hpAfter, e.maxHp)), 1);
    if (e.type === "damage") {
      const effMsg = `It's ${(e.eff ?? 1) > 1 ? "super effective!" : "not very effective..."}`;
      if (e.why === "recoil") {
        res.push(text(`${src} was hurt by recoil!`));
      } else if (e.why === "crash") {
        res.push(text(`${src} kept going and crashed!`));
      } else if (e.why === "seeded") {
        res.push(text(`${src}'s health was sapped by Leech Seed!`));
      } else if (e.why === "psn") {
        res.push(text(`${src} is hurt by poison!`));
      } else if (e.why === "brn") {
        res.push(text(`${src} is hurt by its burn!`));
      } else if (e.why === "attacked" && e.isCrit) {
        res.push(text("A critical hit!"));
      } else if (e.why === "confusion") {
        res.push(text("It hurt itself in its confusion!"));
      } else if (e.why === "ohko") {
        res.push(text("It's a one-hit KO!"));
      } else if (e.why === "trap") {
        res.push(text(`${src}'s attack continues!`));
      }

      if (e.why === "attacked" && e.hitCount === undefined && (e.eff ?? 1) !== 1) {
        res.push(italic(effMsg));
      }

      if (e.why !== "explosion") {
        res.push(text([`${target} lost `, bold(`${percent}%`), " of its health."], "red"));
      }

      if (e.why === "substitute") {
        res.push(text(`${src} put in a substitute!`));
      }

      if ((e.hitCount ?? 0) > 0) {
        if (e.eff !== 1) {
          res.push(italic(effMsg));
        }
        res.push(text(`Hit ${e.hitCount} time(s)!`));
      }

      if (e.hpAfter === 0) {
        res.push(text(`${target} fainted!`));
      }
    } else {
      if (e.why === "drain") {
        res.push(text(`${src} had its energy drained!`));
      } else if (e.why === "recover") {
        res.push(text(`${src} regained health!`));
      } else if (e.why === "rest") {
        res.push(text(`${src} started sleeping!`));
      }

      res.push(text([`${target} gained `, bold(`${percent}%`), " of its health."], "green"));
    }
  } else if (e.type === "move") {
    if (e.thrashing && e.move !== "rage") {
      res.push(text(`${pname(e.src)}'s thrashing about!`, "move"));
    } else if (e.disabled) {
      res.push(text(`${pname(e.src)}'s ${moveList[e.move].name} is disabled!`, "move"));
    } else {
      res.push(text([`${pname(e.src)} used `, bold(moveList[e.move].name), "!"], "move"));
    }
  } else if (e.type === "victory") {
    if (e.id === myId.value) {
      res.push(text("You win!"));
    } else {
      res.push(text(`${players[e.id].name} wins!`));
    }
  } else if (e.type === "hit_sub") {
    if (e.confusion) {
      res.push(text("It hurt itself in its confusion!"));
    }

    const eff = e.eff ?? 1;
    if (eff !== 1) {
      res.push(italic(`It's ${(e.eff ?? 1) > 1 ? "super effective!" : "not very effective..."}`));
    }

    const target = pname(e.target);
    res.push(text(`${target}'s substitute took the hit!`));
    if (e.broken) {
      res.push(text(`${target}'s substitute broke!`));
    }
  } else if (e.type === "status") {
    const table: Record<Status, string> = {
      psn: "was poisoned",
      par: "was paralyzed",
      slp: "fell asleep",
      frz: "was frozen solid",
      tox: "was badly poisoned",
      brn: "was burned",
    };

    res.push(text(`${pname(e.id)} ${table[e.status]}!`));
  } else if (e.type === "stages") {
    const name = pname(e.id);
    for (const [stage, amount] of e.stages) {
      res.push(
        text(
          `${name}'s ${stageTable[stage]} ${amount > 0 ? "rose" : "fell"}${
            Math.abs(amount) > 1 ? " sharply" : ""
          }!`
        )
      );
    }
  } else if (e.type === "info") {
    const messages: Record<InfoReason, string> = {
      immune: "It doesn't affect {l}...",
      miss: "{} missed!",
      cant_substitute: "{} doesn't have enough HP to create a substitute!",
      has_substitute: "{} already has a substitute!",
      fail_generic: "But it failed!",
      whirlwind: "But it failed!",
      flinch: "{} flinched!",
      splash: "No effect!",
      seeded: "{} was seeded!",
      mist_protect: "{} is protected by the mist!",
      mist: "{}'s' shrouded in mist!",
      light_screen: "{}'s protected against special attacks!",
      reflect: "{} is gained armor!",
      focus: "{} is getting pumped!",
      payday: "Coins scattered everywhere!",
      became_confused: "{} became confused!",
      confused: "{} is confused!",
      confused_end: "{}'s confused no more!",
      recharge: "{} must recharge!",
      frozen: "{} is frozen solid!",
      sleep: "{} is fast asleep!",
      wake: "{} woke up!",
      haze: "All status changes were removed!",
      thaw: "{} thawed out!",
      paralyze: "{}'s fully paralyzed!",
      rage: "{}'s rage is building!",
      disable_end: "{}'s disabled no more!",
      bide: "{} unleashed energy!",
      trapped: "{} can't move!",
      forfeit: "{} forfeit the match.",
    };

    if (e.why === "forfeit") {
      res.push(text(messages[e.why].replace("{}", players[e.id].name)));
    } else {
      res.push(
        text(
          messages[e.why].replace("{}", pname(e.id)).replace("{l}", pname(e.id, false)),
          e.why === "confused" ? "confused" : ""
        )
      );
    }
  } else if (e.type === "transform") {
    res.push(text(`${pname(e.src)} transformed into ${pname(e.target, false)}!`));
  } else if (e.type === "disable") {
    res.push(text(`${pname(e.id)}'s ${moveList[e.move].name} was disabled!`));
  } else if (e.type === "charge") {
    const chargeMessage: Partial<Record<MoveId, string>> = {
      skullbash: "{} lowered its head!",
      razorwind: "{} made a whirlwind!",
      skyattack: "{} is glowing!",
      solarbeam: "{} took in sunlight!",
      dig: "{} dug a hole!",
      fly: "{} flew up high!",
    };

    const msg = chargeMessage[e.move];
    if (msg) {
      res.push(text(msg.replace("{}", pname(e.id))));
    }
  } else if (e.type === "mimic") {
    res.push(text(`${pname(e.id)} learned ${moveList[e.move].name}!`));
  } else if (e.type === "conversion") {
    res.push(text(`Converted type to match ${pname(e.target, false)}!`));
  } else {
    res.push(text(JSON.stringify(e)));
  }

  return res;
};
</script>
