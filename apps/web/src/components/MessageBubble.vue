<template>
  <div
    class="flex items-end gap-2"
    :class="isMine ? 'justify-end' : 'justify-start'"
  >
    <Avatar
      v-if="!isMine && senderUser"
      :user="senderUser"
      size="sm"
      :online="false"
    />
    <div class="flex flex-col min-w-0 max-w-[72%]">
      <div
        v-if="!isMine && showSenderName && senderUser"
        class="text-[11px] text-gray-500 mb-0.5 px-0.5 truncate"
      >
        {{ senderUser.nickname }}
      </div>

      <!-- Image -->
      <a
        v-if="message.type === 'image' && message.mediaUrl"
        :href="resolveMedia(message.mediaUrl)"
        target="_blank"
        rel="noreferrer"
        class="block rounded-2xl overflow-hidden shadow-sm"
        :class="isMine ? 'rounded-br-sm' : 'rounded-bl-sm'"
      >
        <img
          :src="resolveMedia(message.mediaUrl)"
          :alt="message.mediaName || 'image'"
          class="max-w-[240px] max-h-[320px] object-cover"
        />
      </a>

      <!-- File -->
      <a
        v-else-if="message.type === 'file' && message.mediaUrl"
        :href="resolveMedia(message.mediaUrl)"
        target="_blank"
        rel="noreferrer"
        class="flex items-center gap-3 px-3 py-2 rounded-2xl shadow-sm text-[14px]"
        :class="
          isMine
            ? 'bg-brand text-white rounded-br-sm'
            : 'bg-white text-gray-800 rounded-bl-sm'
        "
      >
        <span class="text-2xl">📎</span>
        <div class="min-w-0">
          <div class="truncate">{{ message.mediaName || "文件" }}</div>
          <div
            class="text-[11px] opacity-80"
            :class="isMine ? 'text-white/80' : 'text-gray-500'"
          >
            {{ formatSize(message.mediaSize) }}
          </div>
        </div>
      </a>

      <!-- Emoji (big sticker-like) -->
      <div
        v-else-if="message.type === 'emoji'"
        class="text-[40px] leading-tight"
      >
        {{ message.content }}
      </div>

      <!-- Text -->
      <div
        v-else
        class="px-3 py-2 rounded-2xl whitespace-pre-wrap break-words text-[15px] leading-relaxed shadow-sm"
        :class="
          isMine
            ? 'bg-brand text-white rounded-br-sm'
            : 'bg-white text-gray-800 rounded-bl-sm'
        "
      >
        {{ message.content }}
      </div>
    </div>
    <Avatar
      v-if="isMine && meUser"
      :user="meUser"
      size="sm"
      :online="false"
    />
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage, PublicUser } from "@im/shared";
import Avatar from "./Avatar.vue";

defineProps<{
  message: ChatMessage;
  isMine: boolean;
  meUser: PublicUser | null;
  senderUser: PublicUser | null;
  showSenderName: boolean;
}>();

function resolveMedia(url: string): string {
  // Media URLs returned by the server start with "/uploads/…". When served
  // through the Vite dev proxy, keep them relative so they go through /api.
  // In production we just return the URL unchanged (server serves uploads).
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) return url;
  return url;
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>
