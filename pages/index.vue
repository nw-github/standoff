<template>
    <div>
        <h1>Status: {{ status }}</h1>
        <p v-if="latestMessage.length !== 0">{{ latestMessage }}</p>
    </div>
</template>

<script setup lang="ts">
const status = ref("loading...");
const latestMessage = ref("");

let ws: WebSocket;
onMounted(() => {
    if (process.server) {
        return;
    }

    const loc = window.location;
    ws = new WebSocket(`${loc.protocol.replace("http", "ws")}//${loc.host}/ws`);
    ws.onopen = () => {
        status.value = "opened!";
        ws.send("hello!");
    };
    ws.onmessage = ({ data }) => {
        latestMessage.value += data.toString() + "\n";
    };
    ws.onerror = console.error;
    ws.onclose = () => {
        status.value = "closed!";
    };
});

onUnmounted(() => {
    ws.close();
});

</script>
