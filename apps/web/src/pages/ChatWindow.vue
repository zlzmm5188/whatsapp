<template>
  <div class="h-full flex flex-col bg-ink-100">
    <!-- header -->
    <header
      class="flex items-center gap-2 px-2 md:px-4 h-14 bg-glass border-b border-black/5 pt-safe"
    >
      <button
        type="button"
        class="pressable md:hidden w-9 h-9 flex items-center justify-center rounded-full text-ink-700"
        @click="goBack"
      >
        <ChevronLeft class="w-6 h-6" :stroke-width="2.25" />
      </button>
      <Avatar v-if="peer" :user="peer" :online="chat.isOnline(peer.id)" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="font-medium text-ink-800 truncate">
          {{ peer?.nickname || "聊天" }}
        </div>
        <div class="text-xs text-ink-400 flex items-center gap-1.5 h-4">
          <template v-if="peer && chat.isDMTyping(peer.id)">
            <span>对方正在输入</span>
            <TypingDots />
          </template>
          <template v-else-if="peer && chat.isOnline(peer.id)">在线</template>
          <template v-else-if="peer">离线</template>
        </div>
      </div>
    </header>

    <!-- messages -->
    <div class="flex-1 min-h-0 relative">
      <div
        ref="scrollEl"
        class="absolute inset-0 overflow-y-auto px-3 md:px-4 py-3 space-y-2"
        @scroll.passive="onScroll"
      >
        <div v-if="!messages.length" class="text-center text-ink-400 text-sm py-10">
          还没有消息，发条消息打个招呼吧
        </div>
        <TransitionGroup name="bubble" tag="div" class="space-y-2">
          <MessageBubble
            v-for="m in messages"
            :key="m.clientId ?? m.id"
            :message="m"
            :is-mine="m.senderId === meId"
            :me-user="auth.user"
            :sender-user="peer"
            :show-sender-name="false"
            @retry="onRetry"
          />
        </TransitionGroup>
      </div>

      <!-- Jump to latest: appears when user scrolls up past the threshold.
           Clicking (or sending a new message) returns to the tail. -->
      <Transition name="fade">
        <button
          v-if="showJumpToLatest"
          type="button"
          class="pressable absolute left-1/2 bottom-3 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white shadow-card text-xs text-ink-700 flex items-center gap-1"
          @click="jumpToLatest"
        >
          <ChevronDown class="w-4 h-4" :stroke-width="2.25" />
          <span v-if="unseenBelow > 0">{{ unseenBelow }} 条新消息</span>
          <span v-else>回到最新</span>
        </button>
      </Transition>
    </div>

    <Composer :on-send="onSend" :on-typing="onTyping" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { ChevronLeft, ChevronDown } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useChatStore, dmKey } from "../stores/chat";
import Avatar from "../components/Avatar.vue";
import Composer from "../components/Composer.vue";
import MessageBubble from "../components/MessageBubble.vue";
import TypingDots from "../components/TypingDots.vue";
import { haptic } from "../utils/haptics";
import type { ChatMessage, MessageType } from "@im/shared";

const props = defineProps<{ peerId: string }>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const scrollEl = ref<HTMLDivElement | null>(null);

// "Near bottom" threshold in px — if the user is within this distance of
// the tail, new messages auto-scroll; otherwise we show the jump button
// instead of yanking them away from the message they're reading.
const NEAR_BOTTOM_PX = 80;
const atBottom = ref(true);
const unseenBelow = ref(0);
const showJumpToLatest = computed(
  () => !atBottom.value && messages.value.length > 0,
);

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
    atBottom.value = true;
    unseenBelow.value = 0;
    await scrollToBottom(false);
  },
  { immediate: true },
);

// When a new message lands, only auto-scroll if the user was already near
// the bottom OR if the latest message is their own (you always want to see
// what you just sent). Otherwise, count it as unseen.
watch(
  () => messages.value.length,
  async (newLen, oldLen) => {
    if (newLen <= (oldLen ?? 0)) return;
    const last = messages.value[messages.value.length - 1];
    const mine = !!last && last.senderId === meId.value;
    if (mine || atBottom.value) {
      await scrollToBottom(true);
      atBottom.value = true;
      unseenBelow.value = 0;
    } else {
      unseenBelow.value += newLen - (oldLen ?? 0);
    }
  },
);

onBeforeUnmount(() => {
  chat.closeChat();
});
onDeactivated(() => {
  chat.closeChat();
});
onActivated(() => {
  if (props.peerId) void chat.openDM(props.peerId);
});

function onScroll(): void {
  const el = scrollEl.value;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  const near = distanceFromBottom <= NEAR_BOTTOM_PX;
  atBottom.value = near;
  if (near) unseenBelow.value = 0;
}

async function scrollToBottom(smooth: boolean): Promise<void> {
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function jumpToLatest(): void {
  atBottom.value = true;
  unseenBelow.value = 0;
  void scrollToBottom(true);
}

function onSend(args: {
  content: string;
  type: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
}) {
  haptic("tap");
  chat.sendDM(props.peerId, args);
}

function onTyping(typing: boolean) {
  chat.sendTypingDM(props.peerId, typing);
}

function onRetry(msg: ChatMessage) {
  if (!msg.clientId) return;
  chat.retrySendDM(props.peerId, msg.clientId);
}

function goBack() {
  router.push({ name: "chats-empty" });
}
</script>
