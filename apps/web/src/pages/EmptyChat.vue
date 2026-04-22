<template>
  <div class="hidden md:flex h-full items-center justify-center bg-ink-100">
    <div class="text-center text-ink-400">
      <div
        class="w-20 h-20 rounded-3xl bg-white shadow-card flex items-center justify-center mx-auto mb-4"
      >
        <MessageCircle class="w-9 h-9 text-brand" :stroke-width="1.5" />
      </div>
      <div class="text-sm">选择一个聊天开始对话</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageCircle } from "lucide-vue-next";
</script>
