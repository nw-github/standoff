<template>
  <div class="w-[256px] h-[234px] items-center justify-center hidden sm:flex">
    <Sprite :species :substitute :kind="back ? 'back' : 'front'" :scale="2" />
  </div>
  <div class="w-[128px] h-[117px] items-center justify-center flex sm:hidden">
    <Sprite :species :substitute :kind="back ? 'back' : 'front'" :scale="1" />
  </div>
</template>

<script setup lang="ts">
import type { Species } from "~/game/species";
defineProps<{ species: Species; back?: boolean; substitute?: boolean }>();
</script>
