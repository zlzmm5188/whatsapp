<template>
  <div
    class="flex items-end gap-2 cv-auto"
    :class="isMine ? 'justify-end' : 'justify-start'"
  >
    <Avatar
      v-if="!isMine && senderUser"
      :user="senderUser"
      size="sm"
      :online="false"
    />
    <div
      class="flex flex-col min-w-0 max-w-[72%]"
      :class="{
        'msg-pending': message.status === 'pending',
        'msg-failed': message.status === 'failed',
      }"
    >
      <div
        v-if="!isMine && showSenderName && senderUser"
        class="text-[11px] text-ink-400 mb-0.5 px-1 truncate"
      >
        {{ senderUser.nickname }}
      </div>

      <!-- Image -->
      <a
        v-if="message.type === 'image' && message.mediaUrl"
        :href="resolveMedia(message.mediaUrl)"
        target="_blank"
        rel="noreferrer"
        class="block rounded-2xl overflow-hidden shadow-bubble"
        :class="isMine ? 'rounded-br-md' : 'rounded-bl-md'"
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
        class="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl shadow-bubble text-[14px]"
        :class="
          isMine
            ? 'bg-brand text-white rounded-br-md'
            : 'bg-white text-ink-800 rounded-bl-md'
        "
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          :class="isMine ? 'bg-white/20' : 'bg-ink-100'"
        >
          <FileIcon
            class="w-5 h-5"
            :class="isMine ? 'text-white' : 'text-ink-600'"
            :stroke-width="1.75"
          />
        </div>
        <div class="min-w-0">
          <div class="truncate font-medium">
            {{ message.mediaName || "文件" }}
          </div>
          <div
            class="text-[11px]"
            :class="isMine ? 'text-white/75' : 'text-ink-500'"
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
        class="px-3.5 py-2 rounded-2xl whitespace-pre-wrap break-words text-[15px] leading-relaxed shadow-bubble"
        :class="
          isMine
            ? 'bg-brand text-white rounded-br-md'
            : 'bg-white text-ink-800 rounded-bl-md'
        "
      >
        {{ message.content }}
      </div>

      <!-- Status row for my own bubble: sending / failed → tap to retry -->
      <div
        v-if="isMine && (message.status === 'pending' || message.status === 'failed')"
        class="flex items-center justify-end gap-1 mt-0.5 pr-1 text-[11px]"
      >
        <span v-if="message.status === 'pending'" class="text-ink-400 flex items-center gap-1">
          <Loader2 class="w-3 h-3 spin-ios" :stroke-width="2.25" />
          <span>发送中</span>
        </span>
        <button
          v-else
          type="button"
          class="pressable text-red-500 flex items-center gap-1"
          title="重发"
          @click="$emit('retry', message)"
        >
          <AlertCircle class="w-3.5 h-3.5" :stroke-width="2.25" />
          <span>发送失败 · 点击重试</span>
        </button>
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
import { File as FileIcon, Loader2, AlertCircle } from "lucide-vue-next";
import Avatar from "./Avatar.vue";

defineProps<{
  message: ChatMessage;
  isMine: boolean;
  meUser: PublicUser | null;
  senderUser: PublicUser | null;
  showSenderName: boolean;
}>();

defineEmits<{
  (e: "retry", message: ChatMessage): void;
}>();

function resolveMedia(url: string): string {
  return url;
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>
