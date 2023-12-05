<template>
    <form>
        <div class="upper">
            <Sprite :back="false" :species="species" />

            <div>
                <input type="text" :placeholder="species.name" />

                <label for="level">Level</label>
                <input type="number" min="1" max="100" value="100" />

                <fieldset>
                    <template v-for="(_, i) in 4">
                        <div>
                            <input :list="`move-${i}`" v-model="moves[i]" />
                            <datalist :id="`move-${i}`">
                                <option v-for="id in unusedMoves" :value="id">
                                    {{ moveList[id].name }}
                                </option>
                            </datalist>
                        </div>
                    </template>
                </fieldset>
            </div>
        </div>

        <fieldset>
            <template v-for="stat in statKeys">
                <div>
                    <label :for="`slider-${stat}`">
                        {{ stat === "hp" ? "HP" : stageTable[stat] }}
                    </label>
                    <input type="range" min="0" max="252" step="4" v-model="statexp[stat]" />
                    <span>{{ statexp[stat] }}</span>
                    <template v-if="stat === 'hp'">
                        <input type="number" min="0" max="15" value="15" :disabled="true" />
                    </template>
                    <template v-else>
                        <input type="number" min="0" max="15" v-model="dvs[stat]" />
                    </template>
                </div>
            </template>
        </fieldset>
    </form>
</template>

<style scoped>
.upper {
    display: flex;
}
</style>

<script setup lang="ts">
import { moveList } from "~/game/moveList";
import { speciesList } from "~/game/species";
import { statKeys, type StageStats, type Stats } from "~/game/utils";

const species = speciesList.mewtwo;
const dvs = reactive<StageStats>({
    atk: 15,
    def: 15,
    spc: 15,
    spe: 15,
});
const statexp = reactive<Stats>({
    hp: 252,
    atk: 252,
    def: 252,
    spc: 252,
    spe: 252,
});
const moves = ref<(string | undefined)[]>([]);
const unusedMoves = computed(() => species.moves.filter(id => !moves.value.includes(id)));
</script>
