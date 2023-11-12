<template>
    <Tooltip>
        <button @click="$emit('click')" :disabled="disabled || !poke.hp">
            {{ poke.name }}
        </button>

        <template #tooltip>
            <ul class="tt-list">
                <li>
                    <h4 class="sb-number">{{ poke.name }}</h4>
                    ({{ species.types.map(toTitleCase).join("/") }})
                    <span v-if="poke.status">({{ poke.status.toUpperCase() }})</span>
                </li>
                <li>
                    <h4 class="sb-number">HP:</h4>
                    {{ poke.hp }}/{{ poke.stats.hp }} ({{
                        roundTo(hpPercentExact(poke.hp, poke.stats.hp), 2)
                    }}%)
                </li>
                <li>
                    <span v-for="(val, stat) in poke.stats">
                        <span v-if="stat !== 'hp'"> {{ val }} {{ toTitleCase(stat) }} / </span>
                    </span>
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
    </Tooltip>
</template>

<script setup lang="ts">
import { speciesList } from "../game/species";
import { Pokemon } from "../game/pokemon";
import { hpPercentExact } from "../game/utils";
import { moveList } from "../game/moveList";

defineEmits<{ (e: "click"): void }>();

const { poke } = defineProps<{ poke: Pokemon; disabled: boolean }>();
const species = speciesList[poke.speciesId];
</script>

<style scoped>
.sb-number {
    display: inline;
    width: 30px;
}

.tt-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
</style>
