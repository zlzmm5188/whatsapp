<template>
  <div class="h-full flex flex-col md:flex-row bg-[#ededed]">
    <!-- Sidebar / nav -->
    <nav
      class="order-2 md:order-1 flex md:flex-col md:w-16 w-full items-center justify-around md:justify-start md:py-4 md:gap-2 bg-[#2e2e2e] text-gray-200 border-t md:border-t-0 md:border-r border-black/20"
    >
      <button
        v-for="item in items"
        :key="item.name"
        class="flex flex-col md:flex-col items-center justify-center gap-0.5 p-3 md:w-14 md:h-14 rounded-xl transition"
        :class="isActive(item.name) ? 'bg-brand text-white' : 'hover:bg-white/10'"
        @click="router.push({ name: item.name })"
      >
        <span class="text-lg">{{ item.icon }}</span>
        <span class="text-[10px] mt-0.5">{{ item.label }}</span>
      </button>
      <div class="flex-1 hidden md:block"></div>
      <button
        class="hidden md:flex items-center justify-center w-10 h-10 rounded-lg text-xs hover:bg-white/10 mb-2"
        :title="auth.user?.nickname ?? ''"
        @click="router.push({ name: 'profile' })"
      >
        <img
          v-if="auth.user?.avatar"
          :src="auth.user.avatar"
          class="w-8 h-8 rounded-lg object-cover"
          alt=""
        />
        <span v-else class="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white">
          {{ initial }}
        </span>
      </button>
    </nav>

    <!-- Content area -->
    <main class="order-1 md:order-2 flex-1 min-h-0 overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const chat = useChatStore();

const items = [
  { name: "chats", label: "聊天", icon: "💬" },
  { name: "contacts", label: "通讯录", icon: "👥" },
  { name: "profile", label: "我", icon: "🙂" },
];

const initial = computed(() =>
  (auth.user?.nickname ?? auth.user?.username ?? "?").slice(0, 1).toUpperCase(),
);

function isActive(name: string): boolean {
  if (name === "chats") {
    return route.matched.some((r) => r.name === "chats");
  }
  return route.name === name;
}

let poll: number | undefined;

onMounted(async () => {
  chat.bindSocket();
  await chat.loadAll();
  // light-touch fallback polling for conversations (every 30s)
  poll = window.setInterval(() => {
    void chat.refreshConversations();
  }, 30000);
});

onBeforeUnmount(() => {
  if (poll) window.clearInterval(poll);
});
</script>
