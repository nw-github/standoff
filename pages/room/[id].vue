<template>
  <template v-if="status === 'loading'">
    <div class="flex gap-2">
      <UIcon name="line-md:loading-loop" class="size-6" />
      <span class="text-xl">Loading...</span>
    </div>
  </template>
  <template v-else-if="status === 'notfound'">
    <h1>Room not found.</h1>
  </template>
  <template v-else>
    <Battle
      :team
      :options
      :players
      :turns
      :chats
      :battlers
      :timer
      @chat="sendChat"
      @forfeit="forfeit"
      @move="selectMove"
      @switch="selectSwitch"
      @cancel="cancelMove"
      @timer="startTimer"
    />
  </template>
</template>

<script setup lang="ts">
import type { Options, Turn } from "~/game/battle";
import type { Pokemon } from "~/game/pokemon";
import type { BattleTimer, Chats, JoinRoomResponse } from "~/server/utils/gameServer";

const { $conn } = useNuxtApp();
const route = useRoute();
const currentTrack = useCurrentTrack();
const status = ref<"loading" | "battle" | "notfound">("loading");
const players = reactive<Record<string, ClientPlayer>>({});
const battlers = ref<string[]>([]);
const turns = ref<Turn[]>([]);
const options = ref<Options>();
const chats = reactive<Chats>({});
const team = ref<Pokemon[]>();
const timer = ref<BattleTimer>();
const room = `${route.params.id}`;

let sequenceNo = 0;
onMounted(() => {
  $conn.emit("joinRoom", room, resp => {
    if (allMusicTracks.length) {
      currentTrack.value = randChoice(allMusicTracks);
    }
    joinRoom(resp);
  });

  $conn.on("connect", () => {
    const clearObj = (foo: Record<string, any>) => {
      for (const k in foo) {
        delete foo[k];
      }
    };

    status.value = "loading";
    turns.value.length = 0;
    battlers.value.length = 0;
    team.value = undefined;
    options.value = undefined;
    timer.value = undefined;
    sequenceNo = 0;

    clearObj(chats);
    clearObj(players);

    // TODO: instead of rejoining the room, send a 'catch up' request with the sequenceNo
    $conn.emit("joinRoom", room, joinRoom);
  });

  $conn.on("nextTurn", async (roomId, turn, opts, tmr) => {
    timer.value = tmr || undefined;
    if (roomId === room) {
      turns.value.push(turn);
      options.value = opts || undefined;
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

  $conn.on("userChat", (roomId, id, message, turn) => {
    if (roomId === room) {
      if (!chats[turn]) {
        chats[turn] = [];
      }

      chats[turn].push({ message, player: id });
    }
  });

  $conn.on("timerStart", (roomId, who, tmr) => {
    if (roomId === room) {
      const turn = Math.max(turns.value.length - 1, 0);
      if (timer.value === undefined) {
        if (!chats[turn]) {
          chats[turn] = [];
        }
        chats[turn].push({ message: `${players[who].name} started the timer.`, player: "" });
      }

      timer.value = tmr || undefined;
    }
  });
});

onUnmounted(() => {
  currentTrack.value = undefined;
});

const joinRoom = (resp: JoinRoomResponse | "bad_room") => {
  if (resp === "bad_room") {
    status.value = "notfound";
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
  timer.value = resp.timer;
  sequenceNo += resp.turns.length;

  for (const k in resp.chats) {
    chats[k] = resp.chats[k];
  }

  if (resp.timer) {
    chats[0] ??= [];
    chats[0].unshift({ player: "", message: "The timer is on." });
  }

  status.value = "battle";
};

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

const startTimer = () => {
  $conn.emit("startTimer", room, err => {
    // TODO: do something with the error
  });
};
</script>
