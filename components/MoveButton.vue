<template>
    <Tooltip>
        <button @click="$emit('click')" :disabled="!option.valid">
            <span class="name">{{ move.name }}</span>
            <span class="info">
                {{ option.pp !== undefined ? option.pp : "--" }}/{{ move.pp }}
            </span>
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
                <li class="padtop">{{ describeMove(option.move) }}</li>
                <li class="padtop">
                    <span class="type">{{ toTitleCase(move.type) }}</span>
                    <span :class="category">{{ toTitleCase(category) }}</span>
                </li>
            </ul>
        </template>
    </Tooltip>
</template>

<script setup lang="ts">
import type { MoveOption } from "../game/battle";
import { moveList } from "../game/moveList";
import { isSpecial } from "../game/utils";

defineEmits<{ (e: "click"): void }>();

const props = defineProps<{ option: MoveOption }>();
const move = computed(() => moveList[props.option.move]);
const category = computed(() => {
    return move.value.power ? (isSpecial(move.value.type) ? "special" : "physical") : "status";
});
const bgColor = computed(() => typeColor[move.value.type]);

const hex2rgba = (rgb: string, a: number) => {
    return `rgba(${rgb
        .slice(1)
        .match(/.{2}/g)!
        .map(n => parseInt(n, 16))
        .join(", ")}, ${a})`;
};
</script>

<style scoped>
button {
    display: flex;
    justify-content: space-between;
    align-content: center;
    border-radius: 5px;
    width: 200px;
    border: 1px solid;
    border-bottom: 0px;
    background-image: linear-gradient(#fff, v-bind(bgColor));
    border-color: v-bind("hex2rgba(bgColor, 0.8)");
    padding: 0.2rem;
}

.info {
    color: #333;
}

.name {
    font-size: 1.2em;
}

li > span {
    width: min-content;
    border-radius: 5px;
    padding: 4px;
    margin: 2px;
}

.type {
    background-color: v-bind("typeColor[move.type]");
}

.physical {
    background-color: #c92112;
}

.special {
    background-color: #4f5870;
}

.status {
    background-color: #8c888c;
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
    width: max-content;
    max-width: 300px;
}

.padtop {
    padding-top: 10px;
}
</style>
