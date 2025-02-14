<template>
  <div class="grid grid-rows-2 sm:grid-cols-2">
    <div class="space-y-2 px-5">
      <h1 class="text-center">{{ status }}</h1>
      <FormatDropdown v-model="format" :disabled="findingMatch" />
      <USelectMenu
        searchable
        placeholder="Select Team..."
        v-model="selectedTeam"
        :options="validTeams"
        :disabled="!formatInfo[format].needsTeam"
        option-attribute="name"
      />
      <UButton
        @click="enterMatchmaking"
        :disabled="!myId.length || (formatInfo[format].needsTeam && !selectedTeam)"
        :color="findingMatch ? 'red' : 'primary'"
      >
        {{ cancelling ? "Cancelling..." : findingMatch ? "Cancel" : "Find Match" }}

        <template #leading v-if="findingMatch || cancelling">
          <UIcon name="heroicons:arrow-path-20-solid" class="animate-spin size-5" />
        </template>
      </UButton>
    </div>

    <div class="space-y-2 px-5">
      <h1 class="text-center">Battles</h1>
      <div class="flex space-x-2">
        <FormatDropdown
          v-model="filterFormats"
          multiple
          class="w-1/2"
          placeholder="Filter by format..."
        />
        <UInput
          v-model="battleQuery"
          icon="heroicons:magnifying-glass-20-solid"
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

<script setup lang="ts">
import { serializeTeam } from "~/composables/states";
import type { RoomDescriptor } from "~/server/utils/gameServer";

const { $conn } = useNuxtApp();
const status = ref("Logging in...");
const username = useState<string>("username", () => `Guest ${Math.round(Math.random() * 10000)}`);
const myId = useMyId();
const findingMatch = ref(false);
const cancelling = ref(false);
const rooms = ref<RoomDescriptor[]>([]);
const format = useLocalStorage<FormatId>("lastFormat", () => "randoms");
const selectedTeam = ref<Team | undefined>();
const myTeams = useMyTeams();
const validTeams = computed(() => myTeams.value.filter(team => team.format === format.value));
watch(format, () => (selectedTeam.value = validTeams.value[0]));

const roomsRows = computed(() =>
  rooms.value.map(room => ({
    name: room.players.join(" vs. "),
    to: "/room/" + room.id,
    format: room.format,
  })),
);
const roomsCols = [
  { key: "type", label: "Type" },
  { key: "name", label: "Players" },
];
const emptyState = {
  label: "There are currently no active battles. Be the first!",
  icon: "heroicons:circle-stack-20-solid",
};
const filterFormats = ref<string[]>([]);
const battleQuery = ref<string>();

onMounted(() => {
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
    const team = selectedTeam.value ? serializeTeam(selectedTeam.value) : undefined;
    $conn.emit("enterMatchmaking", team, format.value, (err, problems) => {
      if (err) {
        findingMatch.value = false;
        status.value = `Matchmaking failed: ${err}`;
        console.log(problems);
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
