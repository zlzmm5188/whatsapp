<template>
  <div class="h-full flex">
    <!-- Conversation list -->
    <aside
      class="w-full md:w-80 flex-shrink-0 bg-[#f7f7f7] border-r border-black/10 flex flex-col"
      :class="{ 'hidden md:flex': activePeerId }"
    >
      <div class="p-3 border-b border-black/10">
        <input
          v-model="keyword"
          class="w-full bg-white rounded-lg px-3 py-2 text-sm border border-black/5 focus:outline-none focus:ring-2 focus:ring-brand/30"
          placeholder="搜索"
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="!filtered.length" class="text-center text-gray-400 text-sm py-10">
          还没有聊天，去通讯录加个好友吧
        </div>
        <button
          v-for="c in filtered"
          :key="c.peer.id"
          class="w-full text-left flex items-center gap-3 px-3 py-3 hover:bg-black/5 transition"
          :class="activePeerId === c.peer.id ? 'bg-black/5' : ''"
          @click="openChat(c.peer.id)"
        >
          <Avatar :user="c.peer" :online="chat.isOnline(c.peer.id)" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-gray-800 truncate">{{ c.peer.nickname }}</span>
              <span v-if="c.lastMessage" class="text-[11px] text-gray-400 flex-shrink-0">
                {{ formatTime(c.lastMessage.createdAt) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <span class="text-sm text-gray-500 truncate">
                {{ c.lastMessage?.content || "打个招呼吧~" }}
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
    <section class="flex-1 min-w-0 bg-[#ededed]" :class="{ 'hidden md:block': !activePeerId }">
      <RouterView />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/Avatar.vue";
import { formatTime } from "../utils/time";

const router = useRouter();
const chat = useChatStore();
const keyword = ref("");

const activePeerId = computed(() => chat.activePeerId);

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return chat.conversations;
  return chat.conversations.filter(
    (c) =>
      c.peer.nickname.toLowerCase().includes(q) ||
      c.peer.username.toLowerCase().includes(q),
  );
});

function openChat(peerId: string) {
  router.push({ name: "chat", params: { peerId } });
}
</script>
