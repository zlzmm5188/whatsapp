<template>
  <div class="h-full flex">
    <!-- Conversation list -->
    <aside
      class="w-full md:w-[340px] flex-shrink-0 bg-white md:bg-ink-50 md:border-r md:border-black/5 flex flex-col"
      :class="{ 'hidden md:flex': hasActive }"
    >
      <div class="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <h1 class="text-[22px] font-semibold tracking-tight text-ink-800">
          聊天
        </h1>
        <button
          type="button"
          class="pressable w-9 h-9 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-700"
          title="发起群聊"
          @click="showCreate = true"
        >
          <Plus class="w-5 h-5" :stroke-width="2.25" />
        </button>
      </div>

      <div class="px-4 pb-2">
        <div
          class="flex items-center gap-2 bg-ink-100 rounded-xl px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-brand/20"
        >
          <Search class="w-4 h-4 text-ink-400" :stroke-width="2" />
          <input
            v-model="keyword"
            class="flex-1 bg-transparent focus:outline-none placeholder:text-ink-400"
            placeholder="搜索"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto pb-2">
        <div v-if="!filtered.length" class="text-center text-ink-400 text-sm py-12 px-6">
          还没有聊天<br />
          <span class="text-xs">去通讯录加个好友或发起群聊吧</span>
        </div>
        <button
          v-for="c in filtered"
          :key="convKey(c)"
          type="button"
          class="pressable w-full text-left flex items-center gap-3 px-4 py-2.5"
          :class="
            activeConvKey === convKey(c)
              ? 'bg-ink-200/70'
              : 'active:bg-ink-200/60'
          "
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
              <span class="font-medium text-ink-800 truncate">
                {{ title(c) }}
              </span>
              <span
                v-if="c.lastMessage"
                class="text-[11px] text-ink-400 flex-shrink-0"
              >
                {{ formatTime(c.lastMessage.createdAt) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <span class="text-sm text-ink-500 truncate">
                {{ preview(c) }}
              </span>
              <span
                v-if="c.unreadCount > 0"
                class="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center"
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
      class="flex-1 min-w-0 bg-ink-100"
      :class="{ 'hidden md:block': !hasActive }"
    >
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
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
import { Plus, Search } from "lucide-vue-next";
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
  await chat.refreshConversations();
  router.push({ name: "group-chat", params: { groupId: g.id } });
}
</script>
