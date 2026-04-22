<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="route.meta.noTransition ? '' : 'fade'" mode="out-in">
      <component :is="Component" :key="route.fullPath" />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();

onMounted(async () => {
  await auth.hydrate();
});
</script>
