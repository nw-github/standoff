<template>
    <form>
        <input type="text" name="name" :placeholder="species.name" id="name" />

        <label for="level">Level</label>
        <input type="number" min="1" max="100" name="level" id="level" value="100" />

        <fieldset>
            <template v-for="(_, i) in Array(4)">
                <div>
                    <select :name="`move-${i}`" :id="`move-${i}`">
                        <option v-for="id in species.moves" :value="id">
                            {{ moveList[id].name }}
                        </option>
                    </select>
                </div>
            </template>
        </fieldset>

        <fieldset>
            <template v-for="stat in stageStatKeys">
                <div>
                    <label :for="`slider-${stat}`">{{ stageTable[stat] }}</label>
                    <input
                        type="range"
                        min="0"
                        max="255"
                        :name="stat"
                        :id="`slider-${stat}`"
                        value="255"
                    />
                    <input
                        type="number"
                        :name="`dv_${stat}`"
                        :id="`dv-${stat}`"
                        min="0"
                        max="15"
                        value="15"
                    />
                </div>
            </template>
        </fieldset>
    </form>
</template>

<script setup lang="ts">
import { moveList } from "~/game/moveList";
import { speciesList } from "~/game/species";
import { stageStatKeys } from "~/game/utils";

const species = speciesList.mewtwo;
</script>

<style scoped></style>
