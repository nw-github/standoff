<template>
    <ul class="tt-list">
        <li>{{ poke.name }} ({{ species.types.map(toTitleCase).join("/") }})</li>
        <li>
            {{ poke.hp }}/{{ poke.stats.hp }} HP ({{
                roundTo(hpPercentExact(poke.hp, poke.stats.hp), 2)
            }}%)
        </li>
        <li>
            <template v-for="(val, stat) in poke.stats">
                <template v-if="stat !== 'hp'">
                    <template v-if="stat !== 'atk'"> / </template>
                    <span :class="statClass(stat)">{{ active?.stats?.[stat] ?? val }}</span>
                    {{ toTitleCase(stat) }}
                </template>
            </template>
        </li>
        <li>
            <ul>
                <li v-for="(move, i) in poke.moves">
                    {{ moveList[move].name }} ({{ poke.pp[i] }}/{{ moveList[move].pp }})
                </li>
            </ul>
        </li>
    </ul>
</template>

<script setup lang="ts">
import type { Pokemon } from "../game/pokemon";
import { speciesList } from "../game/species";
import { moveList } from "../game/moveList";
import { hpPercentExact } from "../game/utils";

const props = defineProps<{ active?: ClientActivePokemon; poke: Pokemon }>();
const species = computed(() => speciesList[props.poke.speciesId]);

const statClass = (stat: "atk" | "def" | "spe" | "spc") => {
    if (!props.active || props.poke.stats[stat] === props.active.stats![stat]) {
        return "";
    }

    return props.poke.stats[stat] > props.active.stats![stat] ? "down" : "up";
};
</script>

<style scoped>
.tt-list {
    list-style: none;
    padding: 0;
    margin: 0;
    width: max-content;
}

.down {
    color: red;
}

.up {
    color: green;
}
</style>
