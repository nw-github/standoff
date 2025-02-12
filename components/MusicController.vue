<template>
  <audio ref="musicController" loop :src="track" autoplay></audio>
</template>

<script setup lang="ts">
const props = defineProps<{ volume?: number }>();

const toast = useToast();
const currentTrack = useCurrentTrack();
const musicController = ref<HTMLAudioElement>();
const track = computed(() => {
  return (
    currentTrack.value &&
    "/" + currentTrack.value.split("/").slice(2).map(encodeURIComponent).join("/")
  );
});

watch(currentTrack, value => {
  if (value) {
    toast.add({
      title: `Now Playing: ${musicTrackName(value)}`,
      icon: "heroicons-outline:speaker-wave",
    });
    if (musicController.value) {
      musicController.value.play().catch(_err => {});
    }
  }
});

effect(() => {
  if (musicController.value) {
    musicController.value.volume = props.volume ?? 1.0;
  }
});
</script>
