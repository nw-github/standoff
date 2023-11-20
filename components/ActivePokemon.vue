<template>
    <div class="self">
        <div class="all-info">
            <div class="info-text">
                <span>{{ poke.name }}</span>
                <span>Lv. {{ poke.level }}</span>
            </div>

            <div class="healthbar">
                <div class="hp-fill"></div>
                <div class="hp-text">{{ hp }}%</div>
            </div>
            <div class="effects">
                <div class="status" v-if="poke.status">
                    {{ poke.status.toUpperCase() }}
                </div>

                <template v-for="(val, stage) in poke.stages">
                    <div v-if="val" :class="val > 0 ? 'up' : 'down'">
                        {{ roundTo(stageMultipliers[val] / 100, 2) }}x {{ toTitleCase(stage) }}
                    </div>
                </template>
            </div>
        </div>
        <Tooltip class="sprite-container">
            <div class="center-item">
                <img class="sprite" :src="sprite" />
            </div>

            <template #tooltip>
                <template v-if="base">
                    <PokemonTTContent :poke="base" :active="poke" />
                </template>
                <template v-else>
                    <ul>
                        <li>{{ species.name }} ({{ species.types.map(toTitleCase).join("/") }})</li>
                        <li><br /></li>
                        <li class="info">{{ minSpe }} to {{ maxSpe }} Spe</li>
                    </ul>
                </template>
            </template>
        </Tooltip>
    </div>
</template>

<style scoped>
.healthbar {
    background-color: #333;
    border-radius: 5px;
    position: relative;
    height: 1.2rem;
}

.hp-fill {
    width: v-bind("hp + '%'");
    background-color: v-bind("hpColor(hp)");
    height: 100%;
    position: absolute;
    border-radius: 5px;
    transition: width 0.5s, background-color 0.5s;
}

.hp-text {
    width: 100%;
    text-align: center;
    position: absolute;
    color: #ccc;
}

.sprite-container {
    width: 50%;
}

.all-info {
    width: 50%;
    order: v-bind("back ? 2 : 0");
    position: relative;
    top: 15%;
    font-size: 0.9em;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.info-text {
    display: flex;
    justify-content: space-between;
}

.sprite {
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    width: v-bind("back ? '80%' : '65%'");
}

.effects {
    display: flex;
    gap: 0.2rem;
    flex-wrap: wrap;
}

.effects > * {
    height: min-content;
    width: max-content;
    padding: 1px 3px;
    color: white;
    border-radius: 5px;
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

.self {
    width: 100%;
    padding: 5px;
    display: flex;
    gap: 1rem;
}

.info {
    font-style: italic;
}

.center-item {
    display: flex;
    align-items: center;
    justify-content: center;
}

ul {
    list-style: none;
    padding: 0;
    margin: 0;
}
</style>

<script setup lang="ts">
import { hpPercent, stageMultipliers } from "../game/utils";
import { calcStat, type Pokemon } from "../game/pokemon";
import { speciesList } from "../game/species";
import "assets/colors.css";

const props = defineProps<{ poke: ClientActivePokemon; base?: Pokemon; back: boolean }>();
const species = computed(() => speciesList[props.poke.speciesId]);
const minSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 0, 0));
const maxSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 15, 65535));
const hp = computed(() =>
    props.base ? hpPercent(props.base.hp, props.base.stats.hp) : props.poke.hp
);
const sprite = computed(() => {
    const dexId = speciesList[props.poke.transformed ?? props.poke.speciesId].dexId;
    if (props.back) {
        return `/sprites/pokemon/back/${dexId}.gif`;
    } else {
        return `/sprites/pokemon/${dexId}.gif`;
    }
});

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
