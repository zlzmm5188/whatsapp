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
        <div class="text-xs text-ink-400 truncate">
          <template v-if="typingLabel">{{ typingLabel }}</template>
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
    <div
      ref="scrollEl"
      class="flex-1 overflow-y-auto px-3 md:px-4 py-3 space-y-2"
    >
      <div v-if="!messages.length" class="text-center text-ink-400 text-sm py-10">
        欢迎加入 <b>{{ group?.name }}</b>，发条消息打个招呼吧
      </div>
      <TransitionGroup name="bubble" tag="div" class="space-y-2">
        <MessageBubble
          v-for="m in messages"
          :key="m.id"
          :message="m"
          :is-mine="m.senderId === meId"
          :me-user="auth.user"
          :sender-user="senderOf(m.senderId)"
          :show-sender-name="true"
        />
      </TransitionGroup>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ChevronLeft, MoreHorizontal } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useChatStore, groupKey } from "../stores/chat";
import GroupAvatar from "../components/GroupAvatar.vue";
import Composer from "../components/Composer.vue";
import MessageBubble from "../components/MessageBubble.vue";
import GroupMembersModal from "../components/GroupMembersModal.vue";
import type { MessageType, PublicUser } from "@im/shared";

const props = defineProps<{ groupId: string }>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const scrollEl = ref<HTMLDivElement | null>(null);
const showMembers = ref(false);

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
  if (names.length === 1) return `${names[0]} 正在输入…`;
  return `${names.slice(0, 2).join("、")} 等 ${names.length} 人正在输入…`;
});

function senderOf(id: string): PublicUser | null {
  return memberById.value[id] ?? null;
}

watch(
  () => props.groupId,
  async (gid) => {
    if (!gid) return;
    await chat.openGroup(gid);
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
  chat.sendGroup(props.groupId, args);
}

function onTyping(typing: boolean) {
  chat.sendTypingGroup(props.groupId, typing);
}

function goBack() {
  router.push({ name: "chats-empty" });
}
</script>
