<template>
  <div
    class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
      <div class="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-gray-800">{{ group.name }}</h3>
          <div class="text-xs text-gray-400 mt-0.5">{{ group.members.length }} 位成员</div>
        </div>
        <button class="text-gray-400 hover:text-gray-600 text-xl leading-none" @click="$emit('close')">×</button>
      </div>

      <div class="p-4 flex-1 overflow-y-auto space-y-4">
        <!-- Members -->
        <div>
          <div class="text-sm text-gray-600 mb-2">成员</div>
          <div class="space-y-1">
            <div
              v-for="m in group.members"
              :key="m.userId"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 text-sm"
            >
              <Avatar :user="m.user" :online="chat.isOnline(m.userId)" size="sm" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 truncate">
                  <span class="font-medium text-gray-800 truncate">{{ m.user.nickname }}</span>
                  <span
                    v-if="m.role === 'owner'"
                    class="text-[10px] bg-brand text-white rounded px-1 py-0.5"
                  >
                    群主
                  </span>
                </div>
                <div class="text-[11px] text-gray-400 truncate">@{{ m.user.username }}</div>
              </div>
              <button
                v-if="canRemove(m.userId, m.role)"
                class="text-xs text-red-500"
                :disabled="busy"
                @click="remove(m.userId)"
              >
                移除
              </button>
            </div>
          </div>
        </div>

        <!-- Add members -->
        <div v-if="addable.length">
          <div class="text-sm text-gray-600 mb-1">
            邀请好友（已选 {{ toAdd.length }}）
          </div>
          <div class="space-y-1 max-h-40 overflow-y-auto border border-black/5 rounded-lg">
            <label
              v-for="f in addable"
              :key="f.id"
              class="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 cursor-pointer text-sm"
            >
              <input type="checkbox" class="accent-brand" :value="f.id" v-model="toAdd" />
              <span class="flex-1 truncate">{{ f.nickname }}</span>
              <span class="text-[11px] text-gray-400 truncate">@{{ f.username }}</span>
            </label>
          </div>
          <button
            class="mt-2 w-full py-1.5 rounded-lg bg-brand text-white text-sm disabled:opacity-50"
            :disabled="!toAdd.length || busy"
            @click="addMembers"
          >
            {{ busy ? "处理中…" : `邀请 ${toAdd.length} 人` }}
          </button>
        </div>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
      </div>

      <div class="px-4 py-3 border-t border-black/10 flex justify-between">
        <button
          class="px-3 py-1.5 rounded-lg bg-white border border-black/10 text-sm text-red-500"
          :disabled="busy"
          @click="leave"
        >
          退出群聊
        </button>
        <button
          class="px-3 py-1.5 rounded-lg bg-white border border-black/10 text-sm text-gray-600"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";
import { useChatStore } from "../stores/chat";
import Avatar from "./Avatar.vue";
import type { GroupDetail } from "@im/shared";

const props = defineProps<{ group: GroupDetail }>();
const emit = defineEmits<{ (e: "close"): void }>();

const chat = useChatStore();
const router = useRouter();
const toAdd = ref<string[]>([]);
const busy = ref(false);
const error = ref("");

const meId = computed(() => chat.meId());
const isOwner = computed(() => props.group.ownerId === meId.value);

const addable = computed(() =>
  chat.friends.filter(
    (f) => !props.group.members.some((m) => m.userId === f.id),
  ),
);

function canRemove(userId: string, role: string): boolean {
  if (userId === meId.value) return false;
  if (role === "owner") return false;
  return isOwner.value;
}

async function addMembers() {
  if (!toAdd.value.length) return;
  busy.value = true;
  error.value = "";
  try {
    await api.addGroupMembers(props.group.id, toAdd.value);
    toAdd.value = [];
    await chat.loadGroupDetail(props.group.id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function remove(userId: string) {
  busy.value = true;
  error.value = "";
  try {
    await api.removeGroupMember(props.group.id, userId);
    await chat.loadGroupDetail(props.group.id);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}

async function leave() {
  if (!confirm("确认退出群聊？")) return;
  busy.value = true;
  error.value = "";
  try {
    await api.leaveGroup(props.group.id);
    await chat.refreshGroups();
    await chat.refreshConversations();
    emit("close");
    router.push({ name: "chats-empty" });
  } catch (err) {
    error.value = errorMessage(err);
    busy.value = false;
  }
}
</script>
