<template>
  <div class="grid grid-cols-2 min-h-full">
    <div class="space-y-2 px-5">
      <h1 class="text-center">{{ status }}</h1>
      <USelectMenu v-model="format" :options="formats" by="id" />
      <USelectMenu placeholder="Select Team..." disabled />
      <UButton
        @click="enterMatchmaking"
        :disabled="!myId.length"
        :color="findingMatch ? 'red' : 'primary'"
        :loading="cancelling"
      >
        {{ cancelling ? "Cancelling..." : findingMatch ? "Cancel" : "Start Matchmaking" }}
      </UButton>
    </div>

    <div class="space-y-2 px-5">
      <h1 class="text-center">Battles</h1>
      <div class="flex space-x-2">
        <USelectMenu
          v-model="filterFormats"
          :options="formatNames"
          multiple
          class="w-1/2"
          placeholder="Filter by format..."
        />
        <UInput
          icon="i-heroicons-magnifying-glass-20-solid"
          :trailing="false"
          placeholder="Search..."
          class="w-full"
        />
      </div>
      <UTable :rows="roomsRows" :columns="roomsCols" :empty-state="emptyState">
        <template #name-data="{ row }">
          <UButton :to="row.to">{{ row.name }}</UButton>
        </template>

        <template #type-data="{ row }">
          <div class="flex items-center space-x-1">
            <UIcon :name="formatInfo[row.format as FormatId].icon" class="size-5" />
            <span>{{ formatInfo[row.format as FormatId].name }}</span>
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import type { RoomDescriptor } from "~/server/utils/gameServer";

const { $conn } = useNuxtApp();
const status = ref("Logging in...");
const username = useState<string>("username", () => `Guest ${Math.round(Math.random() * 10000)}`);
const myId = useMyId();
const findingMatch = ref(false);
const cancelling = ref(false);
const rooms = ref<RoomDescriptor[]>([]);
const formats = battleFormats.map(id => ({
  id,
  label: formatInfo[id].name,
  icon: formatInfo[id].icon,
}));
const format = ref(formats[0]);

const roomsRows = computed(() =>
  rooms.value.map(room => ({
    name: room.players.join(" vs. "),
    to: "/room/" + room.id,
    format: room.format,
  }))
);
const roomsCols = [
  { key: "type", label: "Type" },
  { key: "name", label: "Players" },
];
const emptyState = {
  label: "There are currently no active battles. Be the first!",
  icon: "i-heroicons-circle-stack-20-solid",
};
const formatNames = battleFormats.map(format => formatInfo[format].name);
const filterFormats = ref<string[]>([]);
const battleQuery = ref<string>();

onMounted(() => {
  if (process.server) {
    return;
  }

  status.value = `Logging in as ${username.value}...`;

  $conn.emit("login", username.value, resp => {
    if (resp === "bad_username") {
      status.value = `Login error: ${resp}`;
    } else {
      status.value = `Logged in as ${username.value}`;
      myId.value = resp.id;
    }
  });

  $conn.emit("getRooms", result => {
    rooms.value = result;
  });

  $conn.on("foundMatch", async roomId => {
    await navigateTo(`/room/${roomId}`);
  });
});

const enterMatchmaking = () => {
  if (!findingMatch.value) {
    findingMatch.value = true;
    $conn.emit("enterMatchmaking", [], format.value.id, err => {
      if (err) {
        findingMatch.value = false;
        status.value = `Matchmaking failed: ${err}`;
      }
    });
  } else {
    cancelling.value = true;
    findingMatch.value = false;
    $conn.emit("exitMatchmaking", () => {
      cancelling.value = false;
      status.value = `Logged in as ${username.value}`;
    });
  }
};
</script>
