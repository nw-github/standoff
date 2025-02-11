<template>
  <div class="w-[256px] h-[234px] flex items-center justify-center">
    <Sprite :species="species" :kind="back ? 'back' : 'front'" :scale="0.5" />
  </div>
</template>

<script setup lang="ts">
import type { Species } from "~/game/species";
defineProps<{ species: Species; back?: boolean }>();
</script>
