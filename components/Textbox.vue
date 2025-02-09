<template>
  <div class="textbox">
    <template v-for="(turn, i) in turns">
      <div class="turn" v-if="i">
        <h2>Turn {{ i }}</h2>
      </div>
      <component :is="() => turn" />
    </template>

    <div ref="scrollPoint"></div>
  </div>
</template>

<style scoped>
.textbox {
  overflow-y: auto;
  background-color: #f1f1f1;
}

.textbox > div {
  padding: 0px 5px;
}

.turn {
  background-color: #ccc;
}
</style>

<style>
.textbox h3,
h4,
h5,
h6 {
  font-weight: normal;
}

.textbox .red {
  color: var(--stat-down);
}

.textbox .green {
  color: green;
}
</style>

<script setup lang="ts">
import type { Status } from "../game/pokemon";
import type { BattleEvent, InfoReason } from "../game/events";
import { moveList, type MoveId } from "../game/moveList";
import { hpPercentExact } from "../game/utils";
import type { Turn } from "../game/battle";
import { stageTable } from "#imports";
import "assets/colors.css";

const scrollPoint = ref<HTMLDivElement>();
const turns = ref<VNode[][]>([]);

const props = defineProps<{
  players: Record<string, ClientPlayer>;
  perspective: string;
}>();
const myId = useMyId();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const enterTurn = async (
  { events, switchTurn }: Turn,
  live: boolean,
  cb: (e: BattleEvent) => void
) => {
  if (!switchTurn) {
    turns.value.push([]);
  }
  for (const e of events) {
    turns.value[turns.value.length - 1].push(...htmlForEvent(e));
    cb(e);

    if (live) {
      await nextTick();
      scrollPoint.value?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
      await delay(300);
    }
  }

  if (!live) {
    await nextTick();
    scrollPoint.value?.scrollIntoView();
  }
};

const text = (s: string) => h("p", s);
const bold = (s: string) => h("b", s);
const italic = (s: string) => h("i", s);

const htmlForEvent = (e: BattleEvent) => {
  const players = props.players;
  const pname = (id: string, title = true) => {
    if (id === props.perspective) {
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
      if (e.src === props.perspective) {
        res.push(text(`Come back! ${player.active.name}!`));
      } else {
        res.push(text(`${player.name} withdrew ${player.active.name}!`));
      }
    }

    if (e.src === props.perspective) {
      res.push(h("p", ["Go! ", bold(`${e.name}`), "!"]));
    } else {
      res.push(h("p", [`${player.name} sent in `, bold(`${e.name}`), "!"]));
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
        res.push(
          h("h5", { class: "red" }, [`${target} lost `, bold(`${percent}%`), " of its health."])
        );
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

      res.push(
        h("h5", { class: "green" }, [`${target} gained `, bold(`${percent}%`), " of its health."])
      );
    }
  } else if (e.type === "move") {
    if (e.thrashing && e.move !== "rage") {
      res.push(text(`${pname(e.src)}'s thrashing about!`));
    } else if (e.disabled) {
      res.push(text(`${pname(e.src)}'s ${moveList[e.move].name} is disabled!`));
    } else {
      res.push(h("p", [`${pname(e.src)} used `, bold(moveList[e.move].name), "!"]));
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
    };

    res.push(text(messages[e.why].replace("{}", pname(e.id)).replace("{l}", pname(e.id, false))));
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

const clear = () => {
  turns.value.length = 0;
};

defineExpose({ enterTurn, clear });
</script>
