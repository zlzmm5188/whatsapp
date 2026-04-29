<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="route.meta.noTransition ? '' : 'fade'" mode="out-in">
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
  <!-- Global call UI: full-screen overlay for incoming/outgoing/active
       calls. Mounted at root so it survives route changes. -->
  <CallOverlay />
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useAuthStore } from "./stores/auth";
import { useCallStore } from "./stores/call";
import CallOverlay from "./components/CallOverlay.vue";

const auth = useAuthStore();
const call = useCallStore();

onMounted(async () => {
  await auth.hydrate();
});

// Bind call signaling listeners as soon as the user is authenticated and
// the socket is up. Re-bind on login transitions (e.g. logout → login).
watch(
  () => auth.user?.id,
  (id) => {
    if (id) call.bindSocketListeners();
  },
  { immediate: true },
);
</script>
