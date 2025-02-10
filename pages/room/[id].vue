<template>
  <template v-if="!battleProps">
    <h1 v-if="!battleProps">{{ status }}</h1>
  </template>
  <template v-else>
    <Battle v-bind="battleProps" />
  </template>
</template>

<script setup lang="ts">
const { $conn } = useNuxtApp();
const route = useRoute();
const status = ref("Loading...");
const battleProps = ref<{ init: JoinRoomResponse; room: string }>();

onMounted(() => {
  if (process.server) {
    return;
  }

  const room = `${route.params.id}`;
  $conn.emit("joinRoom", room, resp => {
    if (resp === "bad_room") {
      status.value = "Room not found...";
    } else {
      battleProps.value = { init: resp, room };
    }
  });
});
</script>
