<template>
  <template v-if="!loaded">
    <h1>{{ status }}</h1>
  </template>
  <template v-else>
    <Battle
      :team
      :options
      :players
      :turns
      :chats
      :battlers
      @chat="sendChat"
      @forfeit="forfeit"
      @move="selectMove"
      @switch="selectSwitch"
      @cancel="cancelMove"
    />
  </template>
</template>

<script setup lang="ts">
import type { Options, Turn } from "~/game/battle";
import type { Pokemon } from "~/game/pokemon";
import type { Chats } from "~/server/utils/gameServer";

const { $conn } = useNuxtApp();
const route = useRoute();
const status = ref("Loading...");
const players = reactive<Record<string, ClientPlayer>>({});
const battlers = ref<string[]>([]);
const turns = ref<Turn[]>([]);
const options = ref<Options>();
const chats = reactive<Chats>({});
const team = ref<Pokemon[]>();
const room = `${route.params.id}`;
const loaded = ref(false);

let sequenceNo = 0;
onMounted(() => {
  $conn.emit("joinRoom", room, resp => {
    if (resp === "bad_room") {
      status.value = "Room not found...";
      return;
    }

    for (const { isSpectator, id, name, nPokemon } of resp.players) {
      players[id] = { name, isSpectator, connected: true, nPokemon, nFainted: 0 };
      if (!isSpectator && !battlers.value.includes(id)) {
        battlers.value.push(id);
      }
    }

    turns.value = resp.turns;
    team.value = resp.team;
    options.value = resp.options;
    sequenceNo += resp.turns.length;

    for (const k in resp.chats) {
      chats[k] = resp.chats[k];
    }
    loaded.value = true;
  });

  $conn.on("nextTurn", async (roomId, turn, opts) => {
    if (roomId === room) {
      turns.value.push(turn);
      options.value = opts;
      sequenceNo++;
    }
  });

  $conn.on("userJoin", (roomId, name, id, isSpectator, nPokemon) => {
    if (roomId === room) {
      players[id] = { name, isSpectator, nPokemon, connected: true, nFainted: 0 };
    }
  });

  $conn.on("userLeave", (roomId, id) => {
    if (roomId === room) {
      players[id].connected = false;
    }
  });

  $conn.on("userDisconnect", (roomId, id) => {
    if (roomId === room) {
      players[id].connected = false;
    }
  });

  $conn.on("userChat", (roomId, id, message, turn) => {
    if (roomId === room) {
      if (!chats[turn]) {
        chats[turn] = [];
      }

      chats[turn].push({ message, player: id });
    }
  });
});

const sendChat = (message: string) => {
  $conn.emit("chat", room, message, err => {
    // TODO: do something with the error
  });
};

const forfeit = () => {
  $conn.emit("choose", room, 0, "forfeit", sequenceNo, err => {
    // TODO: do something with the error
  });
};

const selectMove = (index: number) => {
  $conn.emit("choose", room, index, "move", sequenceNo, err => {
    // TODO: do something with the error
  });
};

const selectSwitch = (index: number) => {
  $conn.emit("choose", room, index, "switch", sequenceNo, err => {
    // TODO: do something with the error
  });
};

const cancelMove = () => {
  $conn.emit("cancel", room, sequenceNo, err => {
    // TODO: do something with the error
  });
};
</script>
