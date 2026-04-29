<template>
  <div
    class="relative flex-shrink-0 overflow-hidden text-white flex items-center justify-center font-medium select-none"
    :class="[sizeClass, shapeClass]"
    :style="backgroundStyle"
  >
    <img
      v-if="user.avatar"
      :src="resolveMedia(user.avatar)"
      :alt="user.nickname"
      class="w-full h-full object-cover"
    />
    <span v-else class="drop-shadow-sm">{{ initial }}</span>
    <span
      v-if="online"
      class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand border-2 border-white"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PublicUser } from "@im/shared";
import { resolveMedia } from "../api/base";

const props = withDefaults(
  defineProps<{
    user: PublicUser;
    online?: boolean;
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    square?: boolean;
  }>(),
  { online: false, size: "md", square: false },
);

const initial = computed(() =>
  (props.user.nickname || props.user.username || "?").slice(0, 1).toUpperCase(),
);

const sizeClass = computed(() => {
  switch (props.size) {
    case "xs":
      return "w-7 h-7 text-[12px]";
    case "sm":
      return "w-8 h-8 text-sm";
    case "lg":
      return "w-16 h-16 text-2xl";
    case "xl":
      return "w-24 h-24 text-3xl";
    default:
      return "w-11 h-11 text-base";
  }
});

const shapeClass = computed(() =>
  props.square ? "rounded-xl" : "rounded-full",
);

// Stable gradient per user based on id / username hash, so each person
// gets a consistent colorful fallback avatar.
const PALETTE = [
  ["#07C160", "#0EA47E"],
  ["#2F80ED", "#56A1FF"],
  ["#8E54E9", "#4776E6"],
  ["#FF8A65", "#FF5E62"],
  ["#F7971E", "#FFD200"],
  ["#EC407A", "#AB47BC"],
  ["#26C6DA", "#00796B"],
  ["#5D4037", "#8D6E63"],
];

const backgroundStyle = computed(() => {
  if (props.user.avatar) return {};
  const key = props.user.id || props.user.username || "?";
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  const [a, b] = PALETTE[h % PALETTE.length]!;
  return {
    backgroundImage: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
  };
});
</script>
