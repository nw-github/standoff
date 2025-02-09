<template>
  <UCard>
    <template #header>
      <h1 class="text-2xl text-center pb-5">Your Teams</h1>
      <div class="flex space-x-2">
        <FormatDropdown teamOnly multiple class="w-1/2" placeholder="Filter by format..." />
        <UInput
          icon="i-heroicons-magnifying-glass-20-solid"
          :trailing="false"
          placeholder="Search..."
          class="w-full"
        />
      </div>
    </template>

    <UTable :rows="myTeams" :columns="teamCols">
      <template #actions-header>
        <div class="flex space-x-2 justify-end">
          <UButton color="green" icon="heroicons:arrow-down-tray-20-solid" @click="importTeam">
            Import
          </UButton>
          <UButton color="green" icon="heroicons:plus-20-solid">New</UButton>
        </div>
      </template>
      <template #format-data="{ row }">
        <div class="flex items-center space-x-1">
          <UIcon :name="formatInfo[row.format as FormatId].icon" class="size-5" />
          <span>{{ formatInfo[row.format as FormatId].name }}</span>
        </div>
      </template>
      <template #pokemon-data="{ row }">
        <div class="flex space-x-2">
          <NuxtImg
            v-for="poke in (row as Team).pokemon"
            :srcset="`/sprites/box/${speciesList[poke.species].dexId}.png`"
            :alt="speciesList[poke.species].name"
            width="66px"
            height="60px"
          />
        </div>
      </template>
      <template #actions-data="{ row }">
        <div class="flex justify-end">
          <UDropdown :items="dropdownItems(row)">
            <UButton color="gray" variant="ghost" icon="i-heroicons-ellipsis-horizontal-20-solid" />
          </UDropdown>
        </div>
      </template>
    </UTable>

    <!-- <UPagination /> -->
  </UCard>
</template>

<style scoped>
img {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>

<script setup lang="ts">
import { speciesList } from "~/game/species";

// const moves = ref<(string | undefined)[]>([]);
// const unusedMoves = computed(() => species.moves.filter(id => !moves.value.includes(id)));
const toast = useToast();
const myTeams = useMyTeams();

const teamCols = [
  { key: "format", label: "Format" },
  { key: "name", label: "Name" },
  { key: "pokemon", label: "Pokemon" },
  { key: "actions" },
];

const dropdownItems = (team: Team) => [
  [
    {
      label: "Copy",
      icon: "heroicons-outline:clipboard",
      async click() {
        await navigator.clipboard.writeText(serializeTeam(team));
        toast.add({ title: `Team '${team.name}' copied to clipboard!` });
      },
    },
    { label: "Edit", icon: "heroicons:pencil-square-20-solid" },
    { label: "Export", icon: "heroicons:arrow-up-tray-20-solid" },
    {
      label: "Delete",
      icon: "heroicons:trash",
      click() {
        myTeams.value.splice(myTeams.value.indexOf(team), 1);
      },
    },
  ],
];

const importTeam = async () => {
  const clipboard = await navigator.clipboard.readText();
  const team = clipboard
    .split("\n\n")
    .map(t => t.trim())
    .filter(t => t.length)
    .map(pokeFromString)
    .filter(poke => !Array.isArray(poke)) as EditPokemon[];
  if (!team.length) {
    return;
  }

  myTeams.value.push({
    name: "New Team",
    pokemon: team,
    format: "standard",
  });
};
</script>
