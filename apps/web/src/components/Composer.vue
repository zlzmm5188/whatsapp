<template>
  <div class="bg-white/90 backdrop-blur border-t border-black/5 pb-safe relative">
    <!-- Media preview row -->
    <div
      v-if="pendingFile"
      class="mx-3 mt-2 flex items-center gap-2 bg-ink-100 rounded-xl px-3 py-2 text-sm"
    >
      <img
        v-if="pendingPreview"
        :src="pendingPreview"
        alt=""
        class="w-10 h-10 object-cover rounded-lg"
      />
      <div
        v-else
        class="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-ink-500"
      >
        <FileIcon class="w-5 h-5" :stroke-width="1.75" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="truncate text-ink-800">{{ pendingFile.name }}</div>
        <div class="text-[11px] text-ink-400">
          {{ formatSize(pendingFile.size) }}
        </div>
      </div>
      <button
        class="pressable w-7 h-7 rounded-full bg-white text-ink-500 flex items-center justify-center"
        type="button"
        title="移除"
        @click="clearFile"
      >
        <X class="w-4 h-4" :stroke-width="2" />
      </button>
      <button
        class="pressable px-3 py-1.5 rounded-full bg-brand text-white text-xs font-medium disabled:opacity-50"
        :disabled="sending"
        type="button"
        @click="sendFile"
      >
        {{ sending ? "上传中…" : "发送" }}
      </button>
    </div>

    <div v-if="uploadError" class="mx-3 mt-2 text-xs text-red-500">
      {{ uploadError }}
    </div>

    <div class="flex items-end gap-2 p-2 md:p-3">
      <button
        type="button"
        class="pressable w-10 h-10 flex-shrink-0 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-600"
        title="表情"
        @click="toggleEmoji"
      >
        <Smile class="w-[22px] h-[22px]" :stroke-width="1.75" />
      </button>
      <button
        type="button"
        class="pressable w-10 h-10 flex-shrink-0 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-600"
        title="图片"
        @click="pickImage"
      >
        <ImagePlus class="w-[22px] h-[22px]" :stroke-width="1.75" />
      </button>
      <button
        type="button"
        class="pressable w-10 h-10 flex-shrink-0 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-600"
        title="文件"
        @click="pickFile"
      >
        <Paperclip class="w-[22px] h-[22px]" :stroke-width="1.75" />
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
        class="flex-1 resize-none bg-ink-100 rounded-2xl px-4 py-2.5 text-[15px] leading-snug focus:outline-none focus:ring-2 focus:ring-brand/20 max-h-40"
        placeholder="输入消息"
        @keydown.enter.exact.prevent="sendText"
        @keydown.enter.shift.exact="() => { /* allow newline */ }"
        @input="onInput"
        @blur="stopTyping"
      />
      <button
        class="pressable w-10 h-10 flex-shrink-0 rounded-full bg-brand text-white flex items-center justify-center disabled:opacity-40 disabled:bg-ink-300"
        :disabled="!text.trim()"
        type="button"
        title="发送"
        @click="sendText"
      >
        <Send class="w-[18px] h-[18px]" :stroke-width="2" />
      </button>
    </div>

    <Transition name="fade">
      <div
        v-if="showEmoji"
        class="absolute bottom-[72px] left-3 z-10"
        @click.stop
      >
        <EmojiPicker @pick="onEmojiPick" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import {
  Smile,
  ImagePlus,
  Paperclip,
  Send,
  X,
  File as FileIcon,
} from "lucide-vue-next";
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
