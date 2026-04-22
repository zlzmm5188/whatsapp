<template>
  <div class="h-full flex flex-col md:flex-row bg-ink-100">
    <!-- left: tabs + friend list -->
    <aside
      class="md:w-[340px] w-full flex flex-col md:border-r md:border-black/5 bg-white md:bg-ink-50"
    >
      <div class="px-4 pt-3 pb-2 pt-safe">
        <h1 class="text-[22px] font-semibold tracking-tight text-ink-800">
          通讯录
        </h1>
      </div>
      <div class="px-3 pb-2 flex gap-2">
        <button
          type="button"
          class="pressable flex-1 py-1.5 rounded-xl text-sm font-medium"
          :class="
            tab === 'friends'
              ? 'bg-brand text-white shadow-bubble'
              : 'bg-ink-100 text-ink-600'
          "
          @click="tab = 'friends'"
        >
          好友 ({{ chat.friends.length }})
        </button>
        <button
          type="button"
          class="pressable flex-1 py-1.5 rounded-xl text-sm font-medium relative"
          :class="
            tab === 'requests'
              ? 'bg-brand text-white shadow-bubble'
              : 'bg-ink-100 text-ink-600'
          "
          @click="tab = 'requests'"
        >
          请求
          <span
            v-if="requests.length"
            class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
          >
            {{ requests.length }}
          </span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto pb-2">
        <template v-if="tab === 'friends'">
          <div
            v-if="!chat.friends.length"
            class="text-center text-ink-400 text-sm py-10 px-6"
          >
            还没有好友<br />
            <span class="text-xs">在右侧搜索用户名加个好友吧</span>
          </div>
          <button
            v-for="f in chat.friends"
            :key="f.id"
            type="button"
            class="pressable w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-ink-200/60"
            @click="startChat(f.id)"
          >
            <Avatar :user="f" :online="chat.isOnline(f.id)" />
            <div class="min-w-0">
              <div class="font-medium text-ink-800 truncate">
                {{ f.nickname }}
              </div>
              <div class="text-xs text-ink-400 truncate">@{{ f.username }}</div>
            </div>
          </button>
        </template>

        <template v-else>
          <div
            v-if="!requests.length"
            class="text-center text-ink-400 text-sm py-10 px-6"
          >
            没有待处理的好友请求
          </div>
          <div
            v-for="r in requests"
            :key="r.id"
            class="flex items-center gap-3 px-4 py-3 border-b border-black/5"
          >
            <Avatar :user="r.from" :online="false" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-ink-800 truncate">
                {{ r.from.nickname }}
              </div>
              <div class="text-xs text-ink-500 truncate">
                {{ r.message || "请求加你为好友" }}
              </div>
            </div>
            <button
              type="button"
              class="pressable px-2.5 py-1 text-xs rounded-lg bg-brand text-white"
              @click="accept(r.id)"
            >
              同意
            </button>
            <button
              type="button"
              class="pressable px-2.5 py-1 text-xs rounded-lg bg-ink-100 text-ink-600"
              @click="reject(r.id)"
            >
              拒绝
            </button>
          </div>
        </template>
      </div>
    </aside>

    <!-- right: add friend -->
    <section class="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
      <div class="max-w-md mx-auto">
        <h2 class="text-lg font-semibold text-ink-800">添加好友</h2>
        <p class="text-sm text-ink-500 mt-1">按用户名或昵称搜索</p>

        <div
          class="mt-4 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-bubble focus-within:ring-2 focus-within:ring-brand/20"
        >
          <Search class="w-4 h-4 text-ink-400" :stroke-width="2" />
          <input
            v-model="keyword"
            class="flex-1 bg-transparent focus:outline-none placeholder:text-ink-400"
            placeholder="用户名或昵称"
            @keydown.enter="search"
          />
          <button
            type="button"
            class="pressable px-3 py-1 rounded-lg bg-brand text-white text-xs font-medium disabled:opacity-50"
            :disabled="!keyword.trim() || searching"
            @click="search"
          >
            {{ searching ? "…" : "搜索" }}
          </button>
        </div>

        <p
          v-if="feedback"
          class="text-sm mt-3"
          :class="feedbackError ? 'text-red-500' : 'text-brand-600'"
        >
          {{ feedback }}
        </p>

        <div class="mt-4 space-y-2">
          <div
            v-for="u in results"
            :key="u.id"
            class="flex items-center gap-3 bg-white rounded-xl px-3 py-2 shadow-bubble"
          >
            <Avatar :user="u" :online="chat.isOnline(u.id)" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-ink-800 truncate">
                {{ u.nickname }}
              </div>
              <div class="text-xs text-ink-400 truncate">@{{ u.username }}</div>
            </div>
            <span
              v-if="isFriend(u.id)"
              class="text-xs text-ink-400"
            >
              已是好友
            </span>
            <button
              v-else
              type="button"
              class="pressable flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-brand text-white"
              @click="addFriend(u)"
            >
              <UserPlus class="w-3.5 h-3.5" :stroke-width="2" />
              加好友
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Search, UserPlus } from "lucide-vue-next";
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
