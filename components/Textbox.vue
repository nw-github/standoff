<template>
  <UCard class="card h-full w-full flex flex-col" :ui="{ body: { base: 'grow overflow-auto' } }">
    <template #header>
      <div class="flex justify-between items-center">
        <div>
          <UTooltip v-if="closable" text="Close" :popper="{ placement: 'top' }">
            <UButton
              icon="material-symbols:close"
              variant="ghost"
              color="gray"
              size="lg"
              @click="$emit('close')"
            />
          </UTooltip>
          <UTooltip text="Forfeit" :popper="{ placement: 'top' }">
            <UButton
              icon="material-symbols:flag-rounded"
              variant="ghost"
              color="red"
              size="lg"
              :disabled="!players[myId] || players[myId].isSpectator || !!victor"
              @click="forfeitModalOpen = true"
            />
          </UTooltip>
          <UTooltip text="Open Calculator" :popper="{ placement: 'top' }">
            <UButton icon="iconamoon:calculator-light" variant="ghost" color="gray" size="lg" />
          </UTooltip>
          <UTooltip
            :text="timer === undefined ? 'Start Timer' : 'Timer is on'"
            :popper="{ placement: 'top' }"
          >
            <UButton
              color="gray"
              leading-icon="material-symbols:alarm-add-outline"
              variant="ghost"
              size="sm"
              @click="$emit('timer')"
              :disabled="!players[myId] || players[myId].isSpectator || !!victor || !!timer"
            >
              <span v-if="timer && !hasOptions">--</span>
              <template v-else-if="timer">
                <!-- timestamp is used to keep updating -->
                {{
                  (timestamp,
                  void (timeLeft = Math.floor(
                    (timer.startedAt + timer.duration - Date.now()) / 1000,
                  )))
                }}
                <span :class="timeLeft <= 5 ? 'text-red-400' : ''">{{
                  Math.max(timeLeft, 0)
                }}</span>
              </template>
            </UButton>
          </UTooltip>
        </div>

        <UPopover mode="hover" :popper="{ placement: 'bottom-start' }">
          <UButton
            color="white"
            variant="ghost"
            label="Players"
            trailing-icon="i-heroicons-chevron-down-20-solid"
          />
          <template #panel>
            <div class="p-2 space-y-1 flex flex-col">
              <span v-for="(player, id) in players">{{ playerInfo(player, id) }}</span>
            </div>
          </template>
        </UPopover>
      </div>
    </template>

    <template #default>
      {{ void (turnCounter = 0) }}
      <template v-for="([turn, switchTurn], i) in turns">
        <div class="bg-gray-300 dark:bg-gray-700 w-full px-1" v-if="i && !switchTurn">
          <h2 class="text-xl">Turn {{ ++turnCounter }}</h2>
        </div>
        <div class="events p-1">
          <component :is="() => turn" />
          <template v-for="{ message, player } in chats[i] ?? []">
            <p v-if="player.length">
              <b>{{ players[player].name }}</b
              >: {{ message }}
            </p>
            <p v-else>{{ message }}</p>
          </template>
        </div>
      </template>
      <div ref="scrollPoint"></div>
    </template>

    <template #footer>
      <UInput placeholder="Send a message..." v-model="message" v-on:keyup.enter="sendMessage">
        <template #trailing>
          <UButton
            icon="material-symbols:send"
            variant="link"
            color="gray"
            :padded="false"
            v-show="message !== ''"
            @click="sendMessage"
          />
        </template>
      </UInput>
    </template>
  </UCard>

  <UModal v-model="forfeitModalOpen">
    <UAlert
      title="Are you sure?"
      description="You are about to forfeit the match."
      icon="iconamoon:attention-circle"
      :actions="[
        {
          variant: 'solid',
          color: 'primary',
          label: 'Forfeit',
          click: () => ((forfeitModalOpen = false), $emit('forfeit')),
        },
        {
          variant: 'outline',
          color: 'primary',
          label: 'Cancel',
          click: () => (forfeitModalOpen = false),
        },
      ]"
    />
  </UModal>
</template>

<style scoped>
.card > :nth-child(1) {
  padding: 0.2rem;
}

/* for some reason setting p-0 in the card :ui doesn't work */
.card > :nth-child(2) {
  padding: 0;
}
</style>

<style>
@import "../assets/colors.css";
.events {
  .red {
    color: var(--stat-down);
    @apply text-sm;
  }

  .green {
    color: green;
    @apply text-sm;
  }

  > * {
    padding: 0 0.25rem;
  }

  .move,
  .confused {
    padding-top: 0.5rem;
  }

  .move + .move,
  .move:first-child {
    padding-top: 0;
  }

  .confused + .move {
    padding-top: 0;
  }
}
</style>

<script setup lang="ts">
import { useTimestamp } from "@vueuse/core";
import type { BattleTimer, Chats } from "~/server/utils/gameServer";

const props = defineProps<{
  turns: [VNode[], boolean][];
  players: Record<string, ClientPlayer>;
  chats: Chats;
  victor?: string;
  closable?: boolean;
  timer?: BattleTimer;
  hasOptions: boolean;
}>();
const emit = defineEmits<{
  (e: "chat", message: string): void;
  (e: "forfeit"): void;
  (e: "close"): void;
  (e: "timer"): void;
}>();
const myId = useMyId();
const message = ref("");
const scrollPoint = ref<HTMLDivElement>();
const forfeitModalOpen = ref(false);
const timestamp = useTimestamp({ interval: 1000 });

watch(
  () => props.timer,
  value => {
    console.log("timer: ", value);
  },
);

let timeLeft = 0;

watch([props.chats, props.turns], async () => {
  await nextTick();
  scrollPoint.value?.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
});

const sendMessage = () => {
  const msg = message.value.trim();
  if (msg.length) {
    emit("chat", message.value);
  }
  message.value = "";
};

const playerInfo = (player: ClientPlayer, id: string) => {
  let label = player.name;
  if (id === myId.value) {
    label += " (Me)";
  }
  if (player.isSpectator) {
    label += " (Spectator)";
  }
  if (!player.connected) {
    label += " (Disconnected)";
  }
  return label;
};

let turnCounter = 0;
</script>
