<template>
    <main>
        <h1>{{ status }}</h1>

        <select
            name="mm"
            id="mm"
            v-model="format"
            :disabled="findingMatch || !myId.length || cancelling"
        >
            <option :value="format" v-for="format in battleFormats">
                {{ formatNames[format] }}
            </option>
        </select>

        <button @click="enterMatchmaking" :disabled="!myId.length || cancelling">
            {{
                cancelling
                    ? "Cancelling..."
                    : findingMatch
                    ? "Cancel Matchmaking"
                    : "Enter Matchmaking"
            }}
        </button>

        <div class="rooms">
            <h2>Rooms</h2>
            <table>
                <tr v-for="{ id, players, format } in rooms">
                    <td class="format">{{ formatNames[format] }}</td>
                    <td class="room-td">
                        <NuxtLink class="room" :to="`room/${id}`">
                            {{ players.join(" vs. ") }}
                        </NuxtLink>
                    </td>
                </tr>
            </table>
        </div>
    </main>
</template>

<style scoped>
main {
    display: flex;
    flex-direction: column;
    align-items: center;
}

main > * {
    margin: 5px;
}

.rooms {
    border: 1px #ccc solid;
    border-radius: 5px;
    text-align: center;
    width: 50%;
    max-height: 50vh;
    overflow-y: auto;
}

.rooms table {
    width: 100%;
    border-spacing: 0;
}

h2,
.format {
    background-color: #f1f1f1;
    padding: 5px;
}

a {
    padding: 5px;
}

.room-td {
    display: flex;
}

.room {
    text-decoration: none;
    color: black;
    flex: 1;
}

.room:hover {
    background-color: #ddd;
}
</style>

<script setup lang="ts">
import type { RoomDescriptor } from "~/server/utils/gameServer";

const { $conn } = useNuxtApp();
const status = ref("Logging in...");
const username = useState<string>("username", () => `Guest ${Math.round(Math.random() * 10000)}`);
const myId = useMyId();
const findingMatch = ref(false);
const cancelling = ref(false);
const rooms = ref<RoomDescriptor[]>([]);
const format = useState<FormatId>("format", () => "randoms");

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
        $conn.emit("enterMatchmaking", [], format.value, err => {
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
