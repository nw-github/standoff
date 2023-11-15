<template>
    <div class="self">
        <div class="healthbar">
            <div class="hp-fill" :style="{ width: `${hp}%` }"></div>
            <div class="hp-text">{{ hp }}%</div>
        </div>
        <div class="effects">
            <div v-if="poke.status" class="status center-item" :class="poke.status">
                {{ poke.status.toUpperCase() }}
            </div>
        </div>
        <Tooltip>
            <div class="sprite-container center-item">
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
                        <li class="info">Speed: {{ minSpe }} to {{ maxSpe }}</li>
                    </ul>
                </template>
            </template>
        </Tooltip>
    </div>
</template>

<style scoped>
.effects {
    height: 1.4em;
}

.status {
    height: 100%;
    width: 2.5em;
    color: white;
    border-radius: 5px;
}

.psn, .tox {
    background-color: #C562C5;
}

.brn {
    background-color: #E67352;
}

.frz {
    background-color: #8BB4E6;
}

.slp {
    background-color: #A4A48B;
}

.par {
    background-color: #BEBE18;
}

.healthbar {
    background-color: #333;
    border-radius: 5px;
    position: relative;
    height: 20px;
    margin-bottom: 5px;
}

.hp-fill {
    background-color: #007f00;
    width: 100%;
    height: 100%;
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

.sprite {
    width: 80%;
}

.self {
    width: 200px;
    padding: 5px;
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
import { hpPercent } from "../game/utils";
import { calcStat, type Pokemon } from "../game/pokemon";
import { speciesList } from "../game/species";

const props = defineProps<{ poke: ClientActivePokemon; base?: Pokemon }>();
const species = computed(() => speciesList[props.poke.speciesId]);
const minSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 0, 0));
const maxSpe = computed(() => calcStat(species.value.stats.spe, props.poke.level, 15, 65535));
const hp = computed(() =>
    props.base ? hpPercent(props.base.hp, props.base.stats.hp) : props.poke.hp
);
const sprite = computed(() => {
    const root = "/sprites/sprites/pokemon/versions/generation-v/black-white/animated";
    const dexId = speciesList[props.poke.transformed ?? props.poke.speciesId].dexId;
    if (props.base) {
        return `${root}/back/${dexId}.gif`;
    } else {
        return `${root}/${dexId}.gif`;
    }
});
</script>
