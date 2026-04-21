<template>
  <div class="h-full flex">
    <!-- Conversation list -->
    <aside
      class="w-full md:w-80 flex-shrink-0 bg-[#f7f7f7] border-r border-black/10 flex flex-col"
      :class="{ 'hidden md:flex': hasActive }"
    >
      <div class="p-3 border-b border-black/10 flex items-center gap-2">
        <input
          v-model="keyword"
          class="flex-1 bg-white rounded-lg px-3 py-2 text-sm border border-black/5 focus:outline-none focus:ring-2 focus:ring-brand/30"
          placeholder="搜索"
        />
        <button
          class="w-9 h-9 rounded-lg bg-white border border-black/5 hover:bg-black/5 text-lg flex-shrink-0"
          title="发起群聊"
          @click="showCreate = true"
        >
          +
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="!filtered.length" class="text-center text-gray-400 text-sm py-10">
          还没有聊天，去通讯录加个好友或发起群聊吧
        </div>
        <button
          v-for="c in filtered"
          :key="convKey(c)"
          class="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-black/5 transition"
          :class="activeConvKey === convKey(c) ? 'bg-black/5' : ''"
          @click="openConv(c)"
        >
          <GroupAvatar
            v-if="c.kind === 'group' && c.group"
            :group="c.group"
          />
          <Avatar
            v-else-if="c.peer"
            :user="c.peer"
            :online="chat.isOnline(c.peer.id)"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-gray-800 truncate">
                {{ title(c) }}
              </span>
              <span v-if="c.lastMessage" class="text-[11px] text-gray-400 flex-shrink-0">
                {{ formatTime(c.lastMessage.createdAt) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <span class="text-sm text-gray-500 truncate">
                {{ preview(c) }}
              </span>
              <span
                v-if="c.unreadCount > 0"
                class="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
              >
                {{ c.unreadCount > 99 ? "99+" : c.unreadCount }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </aside>

    <!-- Active chat -->
    <section
      class="flex-1 min-w-0 bg-[#ededed]"
      :class="{ 'hidden md:block': !hasActive }"
    >
      <RouterView />
    </section>

    <GroupCreateModal
      v-if="showCreate"
      @close="showCreate = false"
      @created="onGroupCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/Avatar.vue";
import GroupAvatar from "../components/GroupAvatar.vue";
import GroupCreateModal from "../components/GroupCreateModal.vue";
import { formatTime } from "../utils/time";
import type { Conversation, GroupDetail } from "@im/shared";

const router = useRouter();
const chat = useChatStore();
const keyword = ref("");
const showCreate = ref(false);

onMounted(() => {
  void chat.loadAll();
});

const activeConvKey = computed(() => chat.activeKey);
const hasActive = computed(() => !!chat.activeKey);

const filtered = computed<Conversation[]>(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return chat.conversations;
  return chat.conversations.filter((c) => title(c).toLowerCase().includes(q));
});

function convKey(c: Conversation): string {
  if (c.kind === "group" && c.group) return `group:${c.group.id}`;
  if (c.peer) return `dm:${c.peer.id}`;
  return "";
}

function title(c: Conversation): string {
  if (c.kind === "group") return c.group?.name ?? "群聊";
  return c.peer?.nickname ?? "";
}

function preview(c: Conversation): string {
  const last = c.lastMessage;
  if (!last) return "打个招呼吧~";
  switch (last.type) {
    case "image":
      return "[图片]";
    case "file":
      return `[文件] ${last.mediaName ?? ""}`;
    case "emoji":
      return last.content;
    default:
      return last.content || "";
  }
}

function openConv(c: Conversation) {
  if (c.kind === "group" && c.group) {
    router.push({ name: "group-chat", params: { groupId: c.group.id } });
  } else if (c.peer) {
    router.push({ name: "chat", params: { peerId: c.peer.id } });
  }
}

async function onGroupCreated(g: GroupDetail) {
  showCreate.value = false;
  // Refresh conversations list so the new group appears immediately.
  await chat.refreshConversations();
  router.push({ name: "group-chat", params: { groupId: g.id } });
}
</script>
