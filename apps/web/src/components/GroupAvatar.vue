<template>
  <div
    class="relative flex-shrink-0 rounded-xl overflow-hidden bg-[#0aa960] text-white flex items-center justify-center font-medium"
    :class="sizeClass"
  >
    <img
      v-if="group.avatar"
      :src="group.avatar"
      :alt="group.name"
      class="w-full h-full object-cover"
    />
    <span v-else class="text-[11px] leading-tight text-center px-1">
      {{ initial }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GroupSummary } from "@im/shared";

const props = withDefaults(
  defineProps<{
    group: GroupSummary;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

const initial = computed(() => (props.group.name || "群").slice(0, 2));

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "w-8 h-8 text-sm";
    case "lg":
      return "w-16 h-16 text-xl";
    default:
      return "w-10 h-10 text-base";
  }
});
</script>
