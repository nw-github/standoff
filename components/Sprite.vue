<template>
  <NuxtImg :srcset="sprite" :alt="species.name" />
</template>

<style scoped>
img {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>

<script setup lang="ts">
import type { Species } from "~/game/species";

const props = defineProps<{
  species: Species;
  kind: "front" | "back" | "box";
  scale?: number;
  substitute?: boolean;
}>();
const sprite = computed(() => {
  const scale = props.scale ? ` ${1 / props.scale}x` : "";
  const id = props.substitute ? "substitute" : props.species.dexId;
  if (props.kind === "front") {
    return `/sprites/battle/${id}.gif${scale}`;
  } else if (props.kind === "back") {
    return `/sprites/battle/back/${id}.gif${scale}`;
  } else {
    return `/sprites/box/${props.species.dexId}.png${scale}`;
  }
});
</script>
