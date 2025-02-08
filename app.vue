<template>
  <UContainer>
    <UCard class="min-h-screen my-6">
      <template #header>
        <nav class="flex justify-between">
          <UHorizontalNavigation :links />
          <div class="flex items-center space-x-3">
            <UToggle
              v-model="dark"
              off-icon="material-symbols:light-mode"
              on-icon="material-symbols:dark-mode"
            />
            <UPopover mode="hover" :popper="{ placement: 'bottom-start' }">
              <UAvatar icon="material-symbols:account-circle-full" />
              <template #panel>
                <div class="p-4">
                  <h2>Username</h2>
                  <div class="h-20 w-48" />
                </div>
              </template>
            </UPopover>
          </div>
        </nav>
      </template>

      <main class="h-full">
        <NuxtPage />
      </main>
    </UCard>
  </UContainer>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
</style>

<script setup lang="ts">
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
    icon: "i-heroicons-home",
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
