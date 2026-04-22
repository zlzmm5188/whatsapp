<template>
  <div class="h-dvh min-h-dvh flex flex-col md:flex-row bg-ink-100 pl-safe pr-safe">
    <!-- Desktop sidebar (md+) -->
    <nav
      class="hidden md:flex md:flex-col w-16 items-center py-4 gap-1 bg-ink-900 text-ink-300"
    >
      <button
        v-for="item in items"
        :key="item.name"
        type="button"
        class="pressable w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5"
        :class="
          isActive(item.name)
            ? 'bg-brand text-white shadow-bubble'
            : 'hover:bg-white/10'
        "
        :title="item.label"
        @click="router.push({ name: item.name })"
      >
        <component :is="item.icon" class="w-5 h-5" :stroke-width="2" />
        <span class="text-[10px] leading-none">{{ item.label }}</span>
      </button>

      <div class="flex-1"></div>

      <button
        type="button"
        class="pressable w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10"
        :title="auth.user?.nickname ?? ''"
        @click="router.push({ name: 'profile' })"
      >
        <Avatar v-if="auth.user" :user="auth.user" size="sm" square />
      </button>
    </nav>

    <!-- Content area -->
    <main class="flex-1 min-h-0 min-w-0 overflow-hidden relative">
      <RouterView v-slot="{ Component, route }">
        <Transition :name="transitionName(route)" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </Transition>
      </RouterView>
    </main>

    <!-- Mobile bottom tab bar (< md) -->
    <nav
      class="md:hidden flex-shrink-0 bg-glass border-t border-black/5 pb-safe"
    >
      <div class="flex items-stretch justify-around">
        <button
          v-for="item in items"
          :key="item.name"
          type="button"
          class="pressable flex-1 py-2 flex flex-col items-center gap-0.5"
          :class="isActive(item.name) ? 'text-brand' : 'text-ink-500'"
          @click="router.push({ name: item.name })"
        >
          <component
            :is="item.icon"
            class="w-6 h-6 transition-transform"
            :class="isActive(item.name) ? 'scale-110' : ''"
            :stroke-width="isActive(item.name) ? 2.25 : 1.75"
          />
          <span class="text-[11px] leading-none">{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter, type RouteLocationNormalized } from "vue-router";
import { MessageCircle, Users, Image as ImageIcon, User } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/Avatar.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const chat = useChatStore();

const items = [
  { name: "chats", label: "聊天", icon: MessageCircle },
  { name: "contacts", label: "通讯录", icon: Users },
  { name: "moments", label: "朋友圈", icon: ImageIcon },
  { name: "profile", label: "我", icon: User },
];

function isActive(name: string): boolean {
  if (name === "chats") {
    return route.matched.some((r) => r.name === "chats");
  }
  return route.name === name;
}

function transitionName(r: RouteLocationNormalized): string {
  // No slide inside the chat list (drill-down handled by its own layout).
  if (r.name === "chat" || r.name === "group-chat" || r.name === "chats-empty") {
    return "";
  }
  return "fade";
}

let poll: number | undefined;

onMounted(async () => {
  chat.bindSocket();
  await chat.loadAll();
  poll = window.setInterval(() => {
    void chat.refreshConversations();
  }, 30000);
});

onBeforeUnmount(() => {
  if (poll) window.clearInterval(poll);
});
</script>
