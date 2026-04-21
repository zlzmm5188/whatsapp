<template>
  <div class="h-full flex flex-col">
    <!-- header -->
    <div class="flex items-center gap-2 px-3 md:px-4 h-14 border-b border-black/10 bg-white">
      <button
        class="md:hidden text-gray-500 px-2"
        @click="goBack"
      >
        ←
      </button>
      <Avatar v-if="peer" :user="peer" :online="chat.isOnline(peer.id)" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="font-medium text-gray-800 truncate">{{ peer?.nickname || "聊天" }}</div>
        <div class="text-xs text-gray-400">
          <template v-if="peer && chat.isTyping(peer.id)">对方正在输入…</template>
          <template v-else-if="peer && chat.isOnline(peer.id)">在线</template>
          <template v-else-if="peer">离线</template>
        </div>
      </div>
    </div>

    <!-- messages -->
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto p-4 space-y-2 bg-[#ededed]"
    >
      <div v-if="!messages.length" class="text-center text-gray-400 text-sm py-8">
        还没有消息，发条消息打个招呼吧
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="flex items-end gap-2"
        :class="m.senderId === meId ? 'justify-end' : 'justify-start'"
      >
        <Avatar
          v-if="m.senderId !== meId && peer"
          :user="peer"
          size="sm"
          :online="false"
        />
        <div
          class="max-w-[72%] px-3 py-2 rounded-2xl whitespace-pre-wrap break-words text-[15px] leading-relaxed shadow-sm"
          :class="
            m.senderId === meId
              ? 'bg-brand text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm'
          "
        >
          {{ m.content }}
        </div>
        <Avatar
          v-if="m.senderId === meId && auth.user"
          :user="auth.user"
          size="sm"
          :online="false"
        />
      </div>
    </div>

    <!-- composer -->
    <div class="p-3 bg-[#f5f5f5] border-t border-black/10">
      <div class="flex items-end gap-2">
        <textarea
          v-model="text"
          rows="1"
          class="flex-1 resize-none bg-white rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/30 max-h-40"
          placeholder="输入消息，Enter 发送 / Shift+Enter 换行"
          @keydown.enter.exact.prevent="send"
          @keydown.enter.shift.exact="() => { /* allow newline */ }"
          @input="onInput"
          @blur="stopTyping"
        />
        <button
          class="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50"
          :disabled="!text.trim()"
          @click="send"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/Avatar.vue";

const props = defineProps<{ peerId: string }>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const text = ref("");
const scrollEl = ref<HTMLDivElement | null>(null);
let typingTimer: number | undefined;

const meId = computed(() => auth.user?.id ?? null);

const peer = computed(
  () =>
    chat.conversations.find((c) => c.peer.id === props.peerId)?.peer ??
    chat.friends.find((f) => f.id === props.peerId) ??
    null,
);

const messages = computed(() => chat.messagesFor(props.peerId));

watch(
  () => props.peerId,
  async (peerId) => {
    if (!peerId) return;
    await chat.openChat(peerId);
    await scrollToBottom();
  },
  { immediate: true },
);

watch(
  () => messages.value.length,
  async () => {
    await scrollToBottom();
  },
);

onBeforeUnmount(() => {
  chat.closeChat();
  if (typingTimer) window.clearTimeout(typingTimer);
});

async function scrollToBottom() {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function send() {
  const content = text.value.trim();
  if (!content) return;
  chat.sendText(props.peerId, content);
  text.value = "";
  stopTyping();
}

function onInput() {
  chat.sendTyping(props.peerId, true);
  if (typingTimer) window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => {
    chat.sendTyping(props.peerId, false);
  }, 1500);
}

function stopTyping() {
  chat.sendTyping(props.peerId, false);
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = undefined;
  }
}

function goBack() {
  router.push({ name: "chats-empty" });
}
</script>
