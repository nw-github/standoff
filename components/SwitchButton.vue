<template>
  <Tooltip>
    <UButton @click="$emit('click')" :disabled="disabled || !poke.hp">
      {{ poke.name }}
    </UButton>

    <template #tooltip>
      <PokemonTTContent :poke="poke" />
    </template>
  </Tooltip>
</template>

<script setup lang="ts">
import { Pokemon } from "../game/pokemon";

defineEmits<{ (e: "click"): void }>();
defineProps<{ poke: Pokemon; disabled: boolean }>();
</script>
