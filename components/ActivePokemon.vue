<template>
  <div class="w-full flex flex-col items-center">
    <div class="relative w-3/4 flex flex-col top-[10%] gap-0.5 sm:gap-1 text-sm">
      <div class="flex justify-between flex-col sm:flex-row space-y-0">
        <span class="font-bold">{{ poke.name }}</span>
        <span class="text-[0.75rem] sm:text-sm">Lv. {{ poke.level }}</span>
      </div>
      <div class="relative h-5 overflow-hidden rounded-md bg-[#333]">
        <div class="hp-fill absolute h-full rounded-md"></div>
        <div class="w-full text-center absolute text-[#ccc]">{{ hp }}%</div>
      </div>
      <div class="relative">
        <div class="flex gap-1 flex-wrap effects absolute">
          <UBadge color="black" v-if="poke.transformed">Transformed</UBadge>

          <template v-if="!species.types.every((ty, i) => ty === poke.conversion?.[i])">
            <TypeBadge v-for="ty in poke.conversion" :typ="ty" />
          </template>

          <UBadge v-if="poke.status" :style="{ backgroundColor: statusColor[poke.status] }">
            {{ poke.status.toUpperCase() }}
          </UBadge>

          <template v-for="(val, stage) in poke.stages">
            <UBadge v-if="val" :class="val > 0 ? 'up' : 'down'">
              {{ roundTo(stageMultipliers[val] / 100, 2) }}x {{ toTitleCase(stage) }}
            </UBadge>
          </template>
        </div>
      </div>
    </div>

    <UPopover mode="hover" :popper="{ placement: 'top', offsetDistance: 0 }">
      <BattleSprite :back="back" :species="species" />

      <template #panel>
        <div class="p-2">
          <template v-if="base && !poke.transformed">
            <PokemonTTContent :poke="base" :active="poke" />
          </template>
          <template v-else>
            <div class="flex flex-col gap-5">
              <div class="flex justify-between space-x-4">
                <span>
                  {{ species.name }}
                  <span v-if="poke.transformed">
                    (Was: {{ speciesList[poke.speciesId].name }})
                  </span>
                </span>
                <div class="flex space-x-1">
                  <TypeBadge v-for="typ in species.types" :typ="typ" />
                </div>
              </div>

              <span class="italic text-center">{{ minSpe }} to {{ maxSpe }} Spe</span>
            </div>
          </template>
        </div>
      </template>
    </UPopover>
  </div>
</template>

<style scoped>
.hp-fill {
  width: v-bind("hp + '%'");
  background-color: v-bind("hpColor(hp)");
  transition: width 0.5s, background-color 0.5s;
}

.effects > * {
  padding: 2px 3px;
}

.status {
  background-color: v-bind("poke.status ? statusColor[poke.status] : 'transparent'");
}

.down {
  background-color: var(--stat-down);
}

.up {
  background-color: var(--stat-up);
}
</style>

<script setup lang="ts">
import { hpPercent, stageMultipliers } from "../game/utils";
import { calcStat, type Pokemon } from "../game/pokemon";
import { speciesList } from "../game/species";
import "assets/colors.css";

const props = defineProps<{ poke: ClientActivePokemon; base?: Pokemon; back?: boolean }>();
const species = computed(() => speciesList[props.poke.transformed ?? props.poke.speciesId]);
const minSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 0, 0));
const maxSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 15, 65535));
const hp = computed(() =>
  props.base ? hpPercent(props.base.hp, props.base.stats.hp) : props.poke.hp
);

// https://stackoverflow.com/questions/8022885/rgb-to-hsv-color-in-javascript/54070620#54070620
const rgb2hsv = (r: number, g: number, b: number) => {
  const v = Math.max(r, g, b);
  const c = v - Math.min(r, g, b);
  const h = c && (v == r ? (g - b) / c : v == g ? 2 + (b - r) / c : 4 + (r - g) / c);
  return { h: 60 * (h < 0 ? h + 6 : h), s: v && c / v, v };
};

const hsv2rgb = (h: number, s: number, v: number) => {
  const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  return [f(5), f(3), f(1)];
};

const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t;
};

const hpColor = (num: number) => {
  const red = rgb2hsv(0xc0, 0, 0);
  const green = rgb2hsv(0, 0x7f, 0);
  const [r, g, b] = hsv2rgb(
    lerp(red.h, green.h, num / 100),
    lerp(red.s, green.s, num / 100),
    lerp(red.v, green.v, num / 100)
  );
  return `rgb(${r}, ${g}, ${b})`;
};
</script>
