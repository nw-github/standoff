<template>
  <UBadge :style="{ backgroundColor: typeColor[type] }">
    {{ label ?? toTitleCase(type) }}
  </UBadge>
</template>

<script setup lang="ts">
import type { Type } from "~/game/utils";

defineProps<{ type: Type; label?: string }>();
</script>
