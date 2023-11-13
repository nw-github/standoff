<template>
    <div class="self">
        <div class="healthbar">
            <div class="hp-fill" style="{ width: hp }"></div>
            <div class="hp-text">{{ base ? hpPercent(base.hp, base.stats.hp) : poke.hp }}%</div>
        </div>
        <Tooltip>
            <img class="sprite" />

            <template v-if="base" #tooltip>
                <PokemonTTContent :poke="base" :active="poke" />
            </template>
            <template v-else #tooltip>
                
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
</style>

<script setup lang="ts">
import { hpPercent } from "../game/utils";
import type { Pokemon } from "../game/pokemon";

defineProps<{ poke: ClientActivePokemon; base?: Pokemon }>();
</script>
