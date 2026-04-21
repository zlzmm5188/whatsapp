<template>
  <div class="p-3 bg-[#f5f5f5] border-t border-black/10 relative">
    <!-- Media preview row -->
    <div
      v-if="pendingFile"
      class="mb-2 flex items-center gap-2 bg-white border border-black/10 rounded-lg px-3 py-2 text-sm"
    >
      <img
        v-if="pendingPreview"
        :src="pendingPreview"
        alt=""
        class="w-10 h-10 object-cover rounded"
      />
      <span v-else class="text-2xl">📎</span>
      <div class="flex-1 min-w-0">
        <div class="truncate">{{ pendingFile.name }}</div>
        <div class="text-[11px] text-gray-400">
          {{ formatSize(pendingFile.size) }}
        </div>
      </div>
      <button
        class="text-gray-400 hover:text-gray-600 text-lg leading-none px-2"
        type="button"
        @click="clearFile"
        title="移除"
      >
        ×
      </button>
      <button
        class="px-3 py-1 rounded-lg bg-brand text-white text-xs"
        :disabled="sending"
        type="button"
        @click="sendFile"
      >
        {{ sending ? "上传中…" : "发送" }}
      </button>
    </div>

    <div v-if="uploadError" class="mb-2 text-xs text-red-500">
      {{ uploadError }}
    </div>

    <div class="flex items-end gap-2">
      <button
        type="button"
        class="w-9 h-9 flex-shrink-0 rounded-lg hover:bg-black/5 text-xl"
        title="表情"
        @click="toggleEmoji"
      >
        😀
      </button>
      <button
        type="button"
        class="w-9 h-9 flex-shrink-0 rounded-lg hover:bg-black/5 text-xl"
        title="图片"
        @click="pickImage"
      >
        🖼️
      </button>
      <button
        type="button"
        class="w-9 h-9 flex-shrink-0 rounded-lg hover:bg-black/5 text-xl"
        title="文件"
        @click="pickFile"
      >
        📎
      </button>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileChange('image', $event)"
      />
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="onFileChange('file', $event)"
      />

      <textarea
        v-model="text"
        rows="1"
        class="flex-1 resize-none bg-white rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/30 max-h-40"
        placeholder="输入消息，Enter 发送 / Shift+Enter 换行"
        @keydown.enter.exact.prevent="sendText"
        @keydown.enter.shift.exact="() => { /* allow newline */ }"
        @input="onInput"
        @blur="stopTyping"
      />
      <button
        class="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
        :disabled="!text.trim()"
        type="button"
        @click="sendText"
      >
        发送
      </button>
    </div>

    <div
      v-if="showEmoji"
      class="absolute bottom-16 left-3 z-10"
      @click.stop
    >
      <EmojiPicker @pick="onEmojiPick" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import EmojiPicker from "./EmojiPicker.vue";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";
import type { MessageType } from "@im/shared";

type FilePickKind = "image" | "file";

const props = defineProps<{
  onSend: (args: {
    content: string;
    type: MessageType;
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    mediaMime?: string;
  }) => void;
  onTyping: (typing: boolean) => void;
}>();

const text = ref("");
const showEmoji = ref(false);
const imageInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pendingFile = ref<File | null>(null);
const pendingPreview = ref<string | null>(null);
const pendingKind = ref<FilePickKind>("file");
const sending = ref(false);
const uploadError = ref("");
let typingTimer: number | undefined;

watch(
  () => pendingFile.value,
  (file) => {
    if (pendingPreview.value) {
      URL.revokeObjectURL(pendingPreview.value);
      pendingPreview.value = null;
    }
    if (file && file.type.startsWith("image/")) {
      pendingPreview.value = URL.createObjectURL(file);
    }
  },
);

onBeforeUnmount(() => {
  if (typingTimer) window.clearTimeout(typingTimer);
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
});

function sendText() {
  const content = text.value.trim();
  if (!content) return;
  props.onSend({ content, type: "text" });
  text.value = "";
  showEmoji.value = false;
  stopTyping();
}

function onInput() {
  props.onTyping(true);
  if (typingTimer) window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => {
    props.onTyping(false);
  }, 1500);
}

function stopTyping() {
  props.onTyping(false);
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = undefined;
  }
}

function toggleEmoji() {
  showEmoji.value = !showEmoji.value;
}

function onEmojiPick(emoji: string) {
  // Send as an "emoji" sticker-style bubble (bigger rendering).
  props.onSend({ content: emoji, type: "emoji" });
  showEmoji.value = false;
}

function pickImage() {
  imageInput.value?.click();
}
function pickFile() {
  fileInput.value?.click();
}

function onFileChange(kind: FilePickKind, ev: Event) {
  const input = ev.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  input.value = "";
  uploadError.value = "";
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) {
    uploadError.value = "文件超过 20 MiB（大文件功能将在第四期开放）";
    return;
  }
  pendingKind.value = kind;
  pendingFile.value = f;
}

function clearFile() {
  pendingFile.value = null;
  uploadError.value = "";
}

async function sendFile() {
  const f = pendingFile.value;
  if (!f || sending.value) return;
  sending.value = true;
  uploadError.value = "";
  try {
    const uploaded = await api.upload(f);
    const type: MessageType =
      pendingKind.value === "image" ? "image" : "file";
    props.onSend({
      content: f.name,
      type,
      mediaUrl: uploaded.url,
      mediaName: uploaded.name,
      mediaSize: uploaded.size,
      mediaMime: uploaded.mime,
    });
    pendingFile.value = null;
  } catch (err) {
    uploadError.value = errorMessage(err);
  } finally {
    sending.value = false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>
