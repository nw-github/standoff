<template>
  <div
    class="flex h-full flex-col sm:flex-row p-4 overflow-auto rounded-lg dark:divide-gray-800 ring-1 ring-gray-200 dark:ring-gray-800 shadow space-x-4"
  >
    <div class="flex flex-col w-full items-center">
      <TeamDisplay class="w-full justify-end" v-if="opponent" :player="players[opponent]" />

      <div class="flex">
        <template v-for="(player, id) in players">
          <div v-if="id === perspective && player.active" class="order-1">
            <div class="h-16"></div>
            <ActivePokemon
              :poke="player.active"
              :base="id === myId ? activeInTeam : undefined"
              back
            />
          </div>
          <div v-else-if="player.active" class="order-2">
            <ActivePokemon :poke="player.active" />
          </div>
        </template>
      </div>

      <div class="relative w-full z-10" v-if="liveEvents.length">
        <div
          class="events absolute w-full flex flex-col bottom-1 p-2 rounded-lg bg-gray-300 dark:bg-gray-700 bg-opacity-90 dark:bg-opacity-90"
        >
          <div v-for="[events, _] in liveEvents">
            <component :is="() => events" />
          </div>
        </div>
      </div>

      <div class="w-full relative" v-if="players[perspective]">
        <TeamDisplay class="absolute bottom-0 justify-start z-0" :player="players[perspective]" />
      </div>

      <UDivider class="pb-2" />

      <div class="w-full">
        <template v-if="options && !selectionText.length && !isRunningTurn">
          <div class="grid sm:grid-rows-[1fr,1.5fr] gap-2 sm:grid-cols-[1fr,1.5fr]">
            <div class="flex flex-col gap-1 sm:gap-2">
              <template v-for="(option, i) in options.moves">
                <MoveButton v-if="option.display" :option="option" @click="selectMove(i)" />
              </template>
            </div>

            <div class="grid grid-cols-2 gap-1 sm:gap-2 items-center">
              <SwitchButton
                v-for="(poke, i) in props.team"
                :poke="poke"
                :disabled="i === activeIndex || !options.canSwitch"
                :active="i === activeIndex"
                @click="selectSwitch(i)"
              />
            </div>
          </div>
        </template>
        <div class="cancel" v-else-if="options && !isRunningTurn">
          <div class="italic">{{ selectionText }}...</div>
          <UButton @click="cancelMove" color="red">Cancel</UButton>
        </div>
        <template v-else-if="!victor">
          <div v-if="!isBattler && !isRunningTurn">
            <UButton @click="perspective = opponent">Switch Sides</UButton>
          </div>
          <div v-else-if="!isRunningTurn" class="italic">Waiting for opponent...</div>
        </template>
        <div v-else>
          <div>{{ victor === myId ? "You" : players[victor].name }} won!</div>
          <UButton to="/">Go Home</UButton>
        </div>
      </div>
    </div>

    <div class="hidden min-[900px]:block h-full w-full">
      <Textbox
        :players="players"
        :chats="chats"
        :turns="htmlTurns"
        @chat="message => $emit('chat', message)"
        @forfeit="$emit('forfeit')"
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
          :chats="chats"
          :turns="htmlTurns"
          @chat="message => $emit('chat', message)"
          @forfeit="$emit('forfeit')"
          @close="slideoverOpen = false"
          :victor="victor"
          closable
        />
      </USlideover>
    </div>

    <audio ref="sfxController"></audio>
  </div>
</template>

<style>
@import "../assets/colors.css";

.events {
  @apply text-sm sm:text-base;

  .red {
    color: var(--stat-down);
    @apply text-xs sm:text-sm;
  }

  .green {
    color: green;
    @apply text-xs sm:text-sm;
  }
}
</style>

<script setup lang="ts">
import type { Options, Turn } from "../game/battle";
import type { Pokemon, Status } from "../game/pokemon";
import type { BattleEvent, InfoReason } from "../game/events";
import { speciesList, type SpeciesId } from "../game/species";
import { clamp, hpPercentExact, randChoice } from "../game/utils";
import { moveList, type MoveId } from "../game/moveList";
import { useElementVisibility, useIntervalFn } from "@vueuse/core";
import { stageTable } from "#imports";

const emit = defineEmits<{
  (e: "chat", message: string): void;
  (e: "forfeit"): void;
  (e: "move", index: number): void;
  (e: "switch", index: number): void;
  (e: "cancel"): void;
}>();
const props = defineProps<{
  team?: Pokemon[];
  options?: Options;
  players: Record<string, ClientPlayer>;
  turns: Turn[];
  chats: Chats;
  battlers: string[];
}>();
const myId = useMyId();
const sfxVol = useSfxVolume();
const currentTrack = useCurrentTrack();
const selectionText = ref("");
const sfxController = ref<HTMLAudioElement>();
const menuButton = ref<HTMLElement>();
const isMenuVisible = useElementVisibility(menuButton);
const unseen = ref(0);
const slideoverOpen = ref(false);
const isRunningTurn = ref(false);

const activeIndex = ref(0);
const activeInTeam = computed<Pokemon | undefined>(() => props.team?.[activeIndex.value]);

const isBattler = computed(() => props.battlers.includes(myId.value));
const perspective = ref<string>("");
const opponent = computed(() => props.battlers.find(v => v != perspective.value));
const victor = ref<string>();
const htmlTurns = ref<[VNode[], boolean][]>([]);
const liveEvents = ref<[VNode[], number][]>([]);
const soundQueue = ref<[string, number][]>([]);

useIntervalFn(() => {
  liveEvents.value = liveEvents.value.filter(ev => Date.now() - ev[1] < 1400);
}, 500);

effect(() => {
  if (sfxController.value) {
    sfxController.value.volume = sfxVol.value ?? 1.0;
    sfxController.value.onended = () => {
      const res = soundQueue.value.shift();
      if (res) {
        sfxController.value!.src = res[0];
        sfxController.value!.play();
        sfxController.value!.playbackRate = res[1];
      }
    };
  }
});

watch(
  () => props.options,
  newOptions => {
    if (newOptions && !props.players[myId.value].active?.transformed) {
      for (const { pp, indexInMoves } of newOptions.moves) {
        if (indexInMoves !== undefined && pp !== undefined) {
          activeInTeam.value!.pp[indexInMoves] = pp;
        }
      }
    }
  },
);

watch(props.turns, () => runTurns(props.turns.slice(htmlTurns.value.length), true));

watch(props.chats, () => {
  if (isMenuVisible.value) {
    unseen.value++;
  }
});

watch(perspective, () => {
  htmlTurns.value.length = 0;
  liveEvents.value.length = 0;
  for (const k in props.players) {
    props.players[k].nFainted = 0;
  }

  runTurns(props.turns, false);
});

onMounted(async () => {
  if (allMusicTracks.length) {
    currentTrack.value = randChoice(allMusicTracks);
  }

  perspective.value = isBattler.value ? myId.value : randChoice(props.battlers);
});

onUnmounted(() => {
  currentTrack.value = undefined;
});

const selectMove = (index: number) => {
  selectionText.value = `${props.players[myId.value].active!.name} will use ${
    moveList[props.options!.moves[index].move].name
  }`;

  emit("move", index);
};

const selectSwitch = (index: number) => {
  selectionText.value = `${props.players[myId.value].active!.name} will be replaced by ${
    props.team![index].name
  }`;

  emit("switch", index);
};

const cancelMove = () => {
  selectionText.value = "";

  emit("cancel");
};

const runTurn = async (turn: Turn, live: boolean) => {
  selectionText.value = "";

  const playSound = (path: string, speed = 1.0, useQueue = false) => {
    if (sfxController.value) {
      if (sfxController.value.paused || !useQueue) {
        sfxController.value.src = path;
        sfxController.value.play();
        sfxController.value.playbackRate = speed;
      } else {
        soundQueue.value.push([path, speed]);
      }
    }
  };

  const playCry = (speciesId: SpeciesId, speed = 1.0) => {
    const track = speciesList[speciesId].dexId.toString().padStart(3, "0");
    playSound(`/effects/cries/${track}.wav`, speed, true);
  };

  const playDmg = (eff: number) => {
    const track = eff > 1 ? "supereffective" : eff < 1 ? "ineffective" : "neutral";
    playSound(`/effects/${track}.mp3`);
  };

  const handleEvent = (e: BattleEvent) => {
    if (e.type === "switch") {
      const player = props.players[e.src];
      player.active = { ...e, stages: {}, substitute: false };
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
      props.players[e.target].active!.hp = e.hpAfter;
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
          playCry(props.players[e.target].active!.speciesId, 0.9);
        }
      }

      if (e.hpAfter === 0) {
        props.players[e.target].nFainted++;
      }

      if (e.why === "rest") {
        props.players[e.target].active!.status = "slp";
        if (e.target === myId.value) {
          activeInTeam.value!.status = "slp";
        }
      }

      if (e.why === "substitute") {
        props.players[e.target].active!.substitute = true;
      }
    } else if (e.type === "status") {
      props.players[e.id].active!.status = e.status;
      if (e.id === myId.value) {
        props.players[e.id].active!.stats = e.stats;
        activeInTeam.value!.status = e.status;
      }
    } else if (e.type === "stages") {
      if (isBattler.value) {
        props.players[myId.value].active!.stats = e.stats;
      }

      const active = props.players[e.id].active!;
      for (const [stat, val] of e.stages) {
        active.stages[stat] = clamp((active.stages[stat] ?? 0) + val, -6, 6);
      }
    } else if (e.type === "transform") {
      const target = props.players[e.target].active!;
      const src = props.players[e.src].active!;
      src.transformed = target.transformed ?? target.speciesId;
      src.stages = { ...target.stages };
    } else if (e.type === "info") {
      if (e.why === "haze") {
        for (const player in props.players) {
          const active = props.players[player].active;
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

        if (isBattler.value) {
          props.players[myId.value].active!.stats = undefined;
        }
      } else if (e.why === "wake" || e.why === "thaw") {
        props.players[e.id].active!.status = undefined;
      }
    } else if (e.type === "conversion") {
      props.players[e.user].active!.conversion = e.types;
    } else if (e.type === "victory") {
      victor.value = e.id;
    } else if (e.type === "hit_sub") {
      if (e.broken) {
        props.players[e.target].active!.substitute = false;
      }
      if (live) {
        playDmg(e.eff ?? 1);
      }
    }
  };

  htmlTurns.value.push([[], turn.switchTurn]);
  for (const e of turn.events) {
    const html = htmlForEvent(e);
    htmlTurns.value.at(-1)![0].push(...html);

    handleEvent(e);
    if (live) {
      liveEvents.value.push([html, Date.now()]);
      await delay(e.type === "damage" ? 500 : 300);
    }
  }
};

let currentTurn: Promise<void> | undefined;
const runTurns = (turns: Turn[], live: boolean) => {
  const task = async () => {
    for (const turn of turns) {
      await runTurn(turn, live);
    }
  };

  if (currentTurn) {
    currentTurn = currentTurn
      .then(() => ((isRunningTurn.value = true), task()))
      .then(() => void (isRunningTurn.value = false));
  } else {
    currentTurn = task().then(() => void (isRunningTurn.value = false));
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const htmlForEvent = (e: BattleEvent) => {
  const text = (s: any, clazz: string = "") => h("p", { class: clazz }, s);
  const bold = (s: any) => h("b", s);
  const italic = (s: any) => h("i", s);
  const pname = (id: string, title = true) => {
    if (id === perspective.value) {
      return props.players[id].active!.name;
    } else if (title) {
      return `The opposing ${props.players[id].active!.name}`;
    } else {
      return `the opposing ${props.players[id].active!.name}`;
    }
  };

  const res: Array<VNode> = [];
  if (e.type === "switch") {
    const player = props.players[e.src];
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
      res.push(text(`${props.players[e.id].name} wins!`));
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
          }!`,
        ),
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
      mist: "{}'s shrouded in mist!",
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
      res.push(text(messages[e.why].replace("{}", props.players[e.id].name)));
    } else {
      res.push(
        text(
          messages[e.why].replace("{}", pname(e.id)).replace("{l}", pname(e.id, false)),
          e.why === "confused" ? "confused" : "",
        ),
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
