<template>
  <div
    class="skeleton-shimmer rounded-lg"
    :class="block ? 'block' : 'inline-block'"
    :style="{ width, height, borderRadius: radius }"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    radius?: string;
    block?: boolean;
  }>(),
  { width: "100%", height: "12px", radius: "8px", block: true },
);
</script>

<style scoped>
.skeleton-shimmer {
  background: linear-gradient(
    100deg,
    rgba(0, 0, 0, 0.04) 20%,
    rgba(0, 0, 0, 0.08) 50%,
    rgba(0, 0, 0, 0.04) 80%
  );
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}
@keyframes skeleton-sweep {
  0% {
    background-position: 150% 0;
  }
  100% {
    background-position: -50% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
    background: rgba(0, 0, 0, 0.06);
  }
}
</style>
