<template>
  <div
    class="relative flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center text-white font-medium select-none"
    :class="sizeClass"
    :style="backgroundStyle"
  >
    <img
      v-if="group.avatar"
      :src="resolveMedia(group.avatar)"
      :alt="group.name"
      class="w-full h-full object-cover"
    />
    <Users v-else class="w-1/2 h-1/2 opacity-90" :stroke-width="1.75" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Users } from "lucide-vue-next";
import type { GroupSummary } from "@im/shared";
import { resolveMedia } from "../api/base";

const props = withDefaults(
  defineProps<{
    group: GroupSummary;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8";
    case "lg":
      return "w-16 h-16";
    default:
      return "w-11 h-11";
  }
});

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
  if (props.group.avatar) return {};
  const key = props.group.id || props.group.name || "?";
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  const [a, b] = PALETTE[h % PALETTE.length]!;
  return { backgroundImage: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` };
});
</script>
