<template>
    <main>
        <h1>Status: {{ status }}</h1>

        <button @click="enterMatchmaking" :enabled="myId.length && !findingMatch">
            Enter Matchmaking
        </button>

        <h2>Rooms</h2>
        <ul>
            <li v-for="room in rooms">
                <NuxtLink :to="`room/${room}`">Room</NuxtLink>
            </li>
        </ul>

        <h2>My Battles</h2>
        <ul>
            <li v-for="room in battles">
                <NuxtLink :to="`room/${room}`">Room</NuxtLink>
            </li>
        </ul>
    </main>
</template>

<script setup lang="ts">
const { $conn } = useNuxtApp();
const status = ref("Logging in...");
const username = useState<string>("username", () => `Guest ${Math.round(Math.random() * 10000)}`);
const myId = useMyId();
const findingMatch = ref(false);
const rooms = ref<string[]>();
const battles = ref<string[]>();

onMounted(() => {
    if (process.server) {
        return;
    }

    status.value = `Logging in as ${username}...`;

    $conn.emit("login", username.value, (resp) => {
        if (resp === "bad_username") {
            status.value = `Login error: ${resp}`;
        } else {
            status.value = `Logged in as ${username.value}`;
            myId.value = resp.id;
            battles.value = resp.rooms;
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
    findingMatch.value = true;
    status.value = "Finding match...";
    $conn.emit("enterMatchmaking", [], err => {
        if (err) {
            findingMatch.value = false;
            status.value = `Matchmaking failed: ${err}`;
        }
    });
};
</script>
