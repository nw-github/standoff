<template>
  <img :srcset="sprite + ' 0.5x'" :alt="species.name" />
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

const props = defineProps<{ species: Species; back: boolean }>();
const sprite = computed(() => {
  if (props.back) {
    return `/sprites/pokemon/back/${props.species.dexId}.gif`;
  } else {
    return `/sprites/pokemon/${props.species.dexId}.gif`;
  }
});
</script>
