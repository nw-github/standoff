<template>
    <div class="self">
        <div class="healthbar">
            <div class="hp-fill" :style="{ width: `${hp}%` }">_</div>
            <div class="hp-text">{{ hp }}%</div>
        </div>
        <Tooltip>
            <img class="sprite" />

            <template #tooltip>
                <template v-if="base">
                    <PokemonTTContent :poke="base" :active="poke" />
                </template>
                <template v-else>
                    <ul>
                        <li>{{ species.name }} ({{ species.types.map(toTitleCase).join("/") }})</li>
                        <li><br /></li>
                        <li class="info">Speed: {{ minSpe }} to {{ maxSpe }}</li>
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
    height: 20px;
    margin-bottom: 10px;
}

.hp-fill {
    background-color: #007f00;
    width: 100%;
    position: absolute;
    border-radius: 5px;
    transition: width 0.5s;
}

.hp-text {
    width: 100%;
    text-align: center;
    position: absolute;
    color: #ccc;
}

.sprite {
    width: 200px;
    height: 200px;
}

.self {
    width: 200px;
    padding: 5px;
}

.info {
    font-style: italic;
}

ul {
    list-style: none;
    padding: 0;
    margin: 0;
}
</style>

<script setup lang="ts">
import { hpPercent } from "../game/utils";
import { calcStat, type Pokemon } from "../game/pokemon";
import { speciesList } from "../game/species";

const { poke, base } = defineProps<{ poke: ClientActivePokemon; base?: Pokemon }>();
const species = speciesList[poke.speciesId];
const minSpe = calcStat(species.stats.spe, poke.level, 0, 0);
const maxSpe = calcStat(species.stats.spe, poke.level, 15, 65535);
const hp = computed(() => base ? hpPercent(base.hp, base.stats.hp) : poke.hp);
</script>
