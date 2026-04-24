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
      <GroupAvatar v-if="group" :group="group" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="font-medium text-ink-800 truncate">
          {{ group?.name || "群聊" }}
        </div>
        <div class="text-xs text-ink-400 flex items-center gap-1.5 h-4">
          <template v-if="typingLabel">
            <span class="truncate">{{ typingLabel }}</span>
            <TypingDots />
          </template>
          <template v-else>{{ memberCount }} 位成员</template>
        </div>
      </div>
      <button
        type="button"
        class="pressable w-9 h-9 flex items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
        title="成员管理"
        @click="showMembers = true"
      >
        <MoreHorizontal class="w-5 h-5" :stroke-width="2" />
      </button>
    </header>

    <!-- messages -->
    <div class="flex-1 min-h-0 relative">
      <div
        ref="scrollEl"
        class="absolute inset-0 overflow-y-auto px-3 md:px-4 py-3 space-y-2"
        @scroll.passive="onScroll"
      >
        <div v-if="!messages.length" class="text-center text-ink-400 text-sm py-10">
          欢迎加入 <b>{{ group?.name }}</b>，发条消息打个招呼吧
        </div>
        <TransitionGroup name="bubble" tag="div" class="space-y-2">
          <MessageBubble
            v-for="m in messages"
            :key="m.clientId ?? m.id"
            :message="m"
            :is-mine="m.senderId === meId"
            :me-user="auth.user"
            :sender-user="senderOf(m.senderId)"
            :show-sender-name="true"
            @retry="onRetry"
          />
        </TransitionGroup>
      </div>

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

    <GroupMembersModal
      v-if="showMembers && group"
      :group="group"
      @close="showMembers = false"
    />
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
import { ChevronLeft, ChevronDown, MoreHorizontal } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useChatStore, groupKey } from "../stores/chat";
import GroupAvatar from "../components/GroupAvatar.vue";
import Composer from "../components/Composer.vue";
import MessageBubble from "../components/MessageBubble.vue";
import TypingDots from "../components/TypingDots.vue";
import GroupMembersModal from "../components/GroupMembersModal.vue";
import { haptic } from "../utils/haptics";
import type { ChatMessage, MessageType, PublicUser } from "@im/shared";

const props = defineProps<{ groupId: string }>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const scrollEl = ref<HTMLDivElement | null>(null);
const showMembers = ref(false);

const NEAR_BOTTOM_PX = 80;
const atBottom = ref(true);
const unseenBelow = ref(0);
const showJumpToLatest = computed(
  () => !atBottom.value && messages.value.length > 0,
);

const meId = computed(() => auth.user?.id ?? null);
const group = computed(() => chat.groupDetails[props.groupId]);
const messages = computed(() => chat.messagesFor(groupKey(props.groupId)));
const memberCount = computed(() => group.value?.members.length ?? 0);

const memberById = computed<Record<string, PublicUser>>(() => {
  const m: Record<string, PublicUser> = {};
  for (const mem of group.value?.members ?? []) {
    m[mem.userId] = mem.user;
  }
  return m;
});

const typingLabel = computed(() => {
  const ids = chat.groupTypingUserIds(props.groupId).filter((id) => id !== meId.value);
  if (!ids.length) return "";
  const names = ids
    .map((id) => memberById.value[id]?.nickname ?? "")
    .filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} 正在输入`;
  return `${names.slice(0, 2).join("、")} 等 ${names.length} 人正在输入`;
});

function senderOf(id: string): PublicUser | null {
  return memberById.value[id] ?? null;
}

watch(
  () => props.groupId,
  async (gid) => {
    if (!gid) return;
    atBottom.value = true;
    unseenBelow.value = 0;
    await chat.openGroup(gid);
    await scrollToBottom(false);
  },
  { immediate: true },
);

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
  if (props.groupId) void chat.openGroup(props.groupId);
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
  chat.sendGroup(props.groupId, args);
}

function onTyping(typing: boolean) {
  chat.sendTypingGroup(props.groupId, typing);
}

function onRetry(msg: ChatMessage) {
  if (!msg.clientId) return;
  chat.retrySendGroup(props.groupId, msg.clientId);
}

function goBack() {
  router.push({ name: "chats-empty" });
}
</script>
