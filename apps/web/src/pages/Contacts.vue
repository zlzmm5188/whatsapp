<template>
  <div class="h-full flex flex-col md:flex-row">
    <!-- left: tabs + friend list -->
    <aside class="md:w-80 w-full flex flex-col border-r border-black/10 bg-[#f7f7f7]">
      <div class="p-3 border-b border-black/10 flex gap-2">
        <button
          class="flex-1 py-1.5 rounded-lg text-sm"
          :class="tab === 'friends' ? 'bg-brand text-white' : 'bg-white text-gray-600'"
          @click="tab = 'friends'"
        >
          好友 ({{ chat.friends.length }})
        </button>
        <button
          class="flex-1 py-1.5 rounded-lg text-sm relative"
          :class="tab === 'requests' ? 'bg-brand text-white' : 'bg-white text-gray-600'"
          @click="tab = 'requests'"
        >
          请求
          <span
            v-if="requests.length"
            class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
          >
            {{ requests.length }}
          </span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <template v-if="tab === 'friends'">
          <div v-if="!chat.friends.length" class="text-center text-gray-400 text-sm py-10">
            还没有好友，去搜索并添加吧
          </div>
          <button
            v-for="f in chat.friends"
            :key="f.id"
            class="w-full flex items-center gap-3 px-3 py-3 hover:bg-black/5 transition text-left"
            @click="startChat(f.id)"
          >
            <Avatar :user="f" :online="chat.isOnline(f.id)" />
            <div>
              <div class="font-medium text-gray-800">{{ f.nickname }}</div>
              <div class="text-xs text-gray-400">@{{ f.username }}</div>
            </div>
          </button>
        </template>

        <template v-else>
          <div v-if="!requests.length" class="text-center text-gray-400 text-sm py-10">
            没有待处理的好友请求
          </div>
          <div
            v-for="r in requests"
            :key="r.id"
            class="flex items-center gap-3 px-3 py-3 border-b border-black/5"
          >
            <Avatar :user="r.from" :online="false" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800 truncate">{{ r.from.nickname }}</div>
              <div class="text-xs text-gray-500 truncate">{{ r.message || "请求加你为好友" }}</div>
            </div>
            <button
              class="px-2.5 py-1 text-xs rounded-lg bg-brand text-white"
              @click="accept(r.id)"
            >
              同意
            </button>
            <button
              class="px-2.5 py-1 text-xs rounded-lg bg-white border border-black/10 text-gray-600"
              @click="reject(r.id)"
            >
              拒绝
            </button>
          </div>
        </template>
      </div>
    </aside>

    <!-- right: add friend -->
    <section class="flex-1 min-w-0 p-4 md:p-8 bg-white overflow-y-auto">
      <h2 class="text-lg font-semibold text-gray-800">添加好友</h2>
      <p class="text-sm text-gray-500 mt-1">按用户名或昵称搜索</p>

      <div class="mt-4 flex gap-2 max-w-md">
        <input
          v-model="keyword"
          class="flex-1 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          placeholder="输入用户名或昵称"
          @keydown.enter="search"
        />
        <button
          class="px-4 py-2 rounded-xl bg-brand text-white text-sm"
          :disabled="!keyword.trim() || searching"
          @click="search"
        >
          {{ searching ? "搜索中…" : "搜索" }}
        </button>
      </div>

      <p v-if="feedback" class="text-sm mt-3" :class="feedbackError ? 'text-red-500' : 'text-green-600'">
        {{ feedback }}
      </p>

      <div class="mt-4 space-y-2 max-w-md">
        <div
          v-for="u in results"
          :key="u.id"
          class="flex items-center gap-3 bg-[#f7f7f7] rounded-xl px-3 py-2"
        >
          <Avatar :user="u" :online="chat.isOnline(u.id)" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-800 truncate">{{ u.nickname }}</div>
            <div class="text-xs text-gray-400 truncate">@{{ u.username }}</div>
          </div>
          <button
            v-if="isFriend(u.id)"
            class="text-xs text-gray-400"
          >
            已是好友
          </button>
          <button
            v-else
            class="px-2.5 py-1 text-xs rounded-lg bg-brand text-white"
            @click="addFriend(u)"
          >
            加为好友
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";
import { useChatStore } from "../stores/chat";
import Avatar from "../components/Avatar.vue";
import type { FriendRequestDTO, PublicUser } from "@im/shared";

const chat = useChatStore();
const router = useRouter();

const tab = ref<"friends" | "requests">("friends");
const requests = ref<FriendRequestDTO[]>([]);
const keyword = ref("");
const results = ref<PublicUser[]>([]);
const searching = ref(false);
const feedback = ref("");
const feedbackError = ref(false);

onMounted(async () => {
  await chat.loadAll();
  await refreshRequests();
});

function isFriend(id: string): boolean {
  return chat.friends.some((f) => f.id === id);
}

async function refreshRequests() {
  try {
    requests.value = await api.friendRequests();
  } catch {
    requests.value = [];
  }
}

async function search() {
  const q = keyword.value.trim();
  if (!q) return;
  searching.value = true;
  feedback.value = "";
  try {
    results.value = await api.searchUsers(q);
    if (!results.value.length) {
      feedback.value = "没有匹配的用户";
      feedbackError.value = false;
    }
  } catch (err) {
    feedback.value = errorMessage(err);
    feedbackError.value = true;
  } finally {
    searching.value = false;
  }
}

async function addFriend(u: PublicUser) {
  feedback.value = "";
  try {
    await api.sendFriendRequest({ toUsername: u.username });
    feedback.value = `已向 ${u.nickname} 发送好友请求`;
    feedbackError.value = false;
  } catch (err) {
    feedback.value = errorMessage(err);
    feedbackError.value = true;
  }
}

async function accept(id: string) {
  try {
    await api.acceptFriendRequest(id);
    await Promise.all([refreshRequests(), chat.loadAll()]);
  } catch (err) {
    feedback.value = errorMessage(err);
    feedbackError.value = true;
  }
}

async function reject(id: string) {
  try {
    await api.rejectFriendRequest(id);
    await refreshRequests();
  } catch (err) {
    feedback.value = errorMessage(err);
    feedbackError.value = true;
  }
}

function startChat(peerId: string) {
  router.push({ name: "chat", params: { peerId } });
}
</script>
