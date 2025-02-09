<template>
  <UBadge :style="{ backgroundColor: typeColor[props.typ] }">
    {{ toTitleCase(props.typ) }}
  </UBadge>
</template>

<script setup lang="ts">
import type { Type } from "~/game/utils";

const props = defineProps<{ typ: Type }>();
</script>
