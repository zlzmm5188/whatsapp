<template>
  <div class="h-full flex flex-col">
    <!-- header -->
    <div class="flex items-center gap-2 px-3 md:px-4 h-14 border-b border-black/10 bg-white">
      <button class="md:hidden text-gray-500 px-2" @click="goBack">←</button>
      <Avatar v-if="peer" :user="peer" :online="chat.isOnline(peer.id)" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="font-medium text-gray-800 truncate">
          {{ peer?.nickname || "聊天" }}
        </div>
        <div class="text-xs text-gray-400">
          <template v-if="peer && chat.isDMTyping(peer.id)">
            对方正在输入…
          </template>
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
      <MessageBubble
        v-for="m in messages"
        :key="m.id"
        :message="m"
        :is-mine="m.senderId === meId"
        :me-user="auth.user"
        :sender-user="peer"
        :show-sender-name="false"
      />
    </div>

    <Composer :on-send="onSend" :on-typing="onTyping" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatStore, dmKey } from "../stores/chat";
import Avatar from "../components/Avatar.vue";
import Composer from "../components/Composer.vue";
import MessageBubble from "../components/MessageBubble.vue";
import type { MessageType } from "@im/shared";

const props = defineProps<{ peerId: string }>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const scrollEl = ref<HTMLDivElement | null>(null);

const meId = computed(() => auth.user?.id ?? null);

const peer = computed(
  () =>
    chat.dmConversation(props.peerId)?.peer ??
    chat.friends.find((f) => f.id === props.peerId) ??
    null,
);

const messages = computed(() => chat.messagesFor(dmKey(props.peerId)));

watch(
  () => props.peerId,
  async (peerId) => {
    if (!peerId) return;
    await chat.openDM(peerId);
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
});

async function scrollToBottom() {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function onSend(args: {
  content: string;
  type: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
}) {
  chat.sendDM(props.peerId, args);
}

function onTyping(typing: boolean) {
  chat.sendTypingDM(props.peerId, typing);
}

function goBack() {
  router.push({ name: "chats-empty" });
}
</script>
