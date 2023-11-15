<template>
    <Tooltip>
        <button @click="$emit('click')" :disabled="!choice.valid">
            <span class="info type">{{ toTitleCase(move.type) }}</span>
            <span class="name">{{ move.name }}</span>
            <span class="info pp">{{ choice.pp !== -1 ? choice.pp : "--" }}/{{ move.pp }}</span>
        </button>

        <template #tooltip>
            <ul class="tt-list">
                <li>
                    <h4 class="mb-number">{{ move.power ?? "--" }}</h4>
                    Power
                </li>
                <li>
                    <h4 class="mb-number">{{ move.acc ?? "--" }}</h4>
                    Accuracy
                </li>
                <li v-if="move.priority">
                    <h4 class="mb-number">
                        {{ move.priority > 0 ? `+${move.priority}` : move.priority }}
                    </h4>
                    Priority
                </li>
                <li class="padtop">{{ desc }}</li>
                <li class="padtop category" v-if="move.power">* {{ spc ? "Special" : "Physical" }}</li>
            </ul>
        </template>
    </Tooltip>
</template>

<script setup lang="ts">
import type { MoveChoice } from "../game/battle";
import { moveList } from "../game/moveList";
import { isSpecial } from "../game/utils";

defineEmits<{ (e: "click"): void }>();

const { choice } = defineProps<{ choice: MoveChoice }>();
const move = moveList[choice.move];
const spc = isSpecial(move.type);
const desc = describeMove(choice.move);
</script>

<style scoped>
button {
    display: grid;
    border-radius: 5px;
    width: 200px;
}

.type {
    text-align: left;
}

.pp {
    text-align: right;
}

.name {
    text-align: center;
    font-size: 1.2em;
}

.mb-number {
    display: inline-block;
    width: 30px;
    padding: 0px;
    margin: 0px;
    text-align: center;
}

.tt-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.padtop {
    padding-top: 10px;
}

.category {
    font-style: italic;
}
</style>
