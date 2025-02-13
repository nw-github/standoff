<template>
  <UContainer class="h-screen py-6">
    <UCard class="h-full flex flex-col" :ui="{ body: { base: 'grow overflow-hidden' } }">
      <template #header>
        <nav class="flex justify-between">
          <UHorizontalNavigation class="hidden sm:block" :links />

          <UPopover class="block sm:hidden" :popper="{ placement: 'bottom-start' }">
            <UButton icon="heroicons:bars-3-16-solid" variant="link" color="gray" />
            <template #panel>
              <UVerticalNavigation :links />
            </template>
          </UPopover>

          <div class="flex items-center space-x-3">
            <UToggle
              v-model="dark"
              off-icon="material-symbols:light-mode"
              on-icon="material-symbols:dark-mode"
            />
            <UPopover mode="hover" :popper="{ placement: 'bottom-start' }">
              <UButton
                :icon="
                  musicVol === 0
                    ? 'heroicons-outline:speaker-x-mark'
                    : 'heroicons-outline:speaker-wave'
                "
                variant="ghost"
                color="gray"
              />
              <template #panel>
                <div class="p-4 w-80 space-y-2">
                  <div>
                    <span>Music</span>
                    <URange :max="1" v-model="musicVol" :step="0.01" />
                  </div>
                  <div>
                    <span>Sound Effects</span>
                    <URange :max="1" v-model="sfxVol" :step="0.01" />
                  </div>
                  <div v-if="currentTrack">
                    <span>Current Track</span>
                    <USelectMenu
                      searchable
                      :options="musicTrackItems"
                      value-attribute="value"
                      v-model="currentTrack"
                    />
                  </div>
                </div>
              </template>
            </UPopover>
            <UPopover mode="hover" :popper="{ placement: 'bottom-start' }">
              <UAvatar icon="material-symbols:account-circle-full" />
              <template #panel>
                <div class="p-4">
                  <h2>Username</h2>
                  <div class="h-2"></div>
                  <UCheckbox label="Announce presence when spectating" />
                </div>
              </template>
            </UPopover>
          </div>
        </nav>
      </template>

      <NuxtPage />
    </UCard>
  </UContainer>

  <UNotifications />
  <MusicController :volume="musicVol" />
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
</style>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";

const musicVol = useLocalStorage("musicVolume", () => 1.0);
const sfxVol = useSfxVolume();
const currentTrack = useCurrentTrack();
const musicTrackItems = allMusicTracks.map(track => ({
  label: musicTrackName(track),
  value: track,
}));

const colorMode = useColorMode();
const dark = computed({
  get() {
    return colorMode.preference === "dark";
  },
  set(v) {
    colorMode.preference = v ? "dark" : "light";
  },
});

const links = [
  {
    label: "Home",
    icon: "heroicons:home",
    to: "/",
  },
  {
    label: "Team Builder",
    icon: "famicons:hammer-outline",
    to: "/teambuilder",
  },
  {
    label: "My Battles",
    icon: "material-symbols:swords-outline",
  },
];
</script>
