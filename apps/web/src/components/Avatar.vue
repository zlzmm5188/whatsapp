<template>
  <div
    class="relative flex-shrink-0 rounded-xl overflow-hidden bg-brand text-white flex items-center justify-center font-medium"
    :class="sizeClass"
  >
    <img
      v-if="user.avatar"
      :src="user.avatar"
      :alt="user.nickname"
      class="w-full h-full object-cover"
    />
    <span v-else>{{ initial }}</span>
    <span
      v-if="online"
      class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PublicUser } from "@im/shared";

const props = withDefaults(
  defineProps<{
    user: PublicUser;
    online?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  { online: false, size: "md" },
);

const initial = computed(() =>
  (props.user.nickname || props.user.username || "?").slice(0, 1).toUpperCase(),
);

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8 text-sm";
    case "lg":
      return "w-16 h-16 text-2xl";
    default:
      return "w-10 h-10 text-base";
  }
});
</script>
