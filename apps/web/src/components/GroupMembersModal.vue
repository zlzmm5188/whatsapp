<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        class="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"
        @click.self="$emit('close')"
      >
        <div
          class="bg-white rounded-t-3xl md:rounded-2xl shadow-card w-full max-w-md flex flex-col max-h-[90dvh] pb-safe"
        >
          <div
            class="px-4 py-3 border-b border-black/5 flex items-center justify-between"
          >
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-ink-800 truncate">
                {{ group.name }}
              </h3>
              <div class="text-xs text-ink-400 mt-0.5">
                {{ group.members.length }} 位成员
              </div>
            </div>
            <button
              type="button"
              class="pressable w-8 h-8 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
              @click="$emit('close')"
            >
              <X class="w-4 h-4" :stroke-width="2" />
            </button>
          </div>

          <div class="p-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <div class="text-sm text-ink-600 mb-2">成员</div>
              <div class="space-y-0.5">
                <div
                  v-for="m in group.members"
                  :key="m.userId"
                  class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-ink-50 text-sm"
                >
                  <Avatar
                    :user="m.user"
                    :online="chat.isOnline(m.userId)"
                    size="sm"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="font-medium text-ink-800 truncate">
                        {{ m.user.nickname }}
                      </span>
                      <span
                        v-if="m.role === 'owner'"
                        class="text-[10px] bg-brand/10 text-brand-700 rounded px-1.5 py-0.5 flex-shrink-0"
                      >
                        群主
                      </span>
                    </div>
                    <div class="text-[11px] text-ink-400 truncate">
                      @{{ m.user.username }}
                    </div>
                  </div>
                  <button
                    v-if="canRemove(m.userId, m.role)"
                    type="button"
                    class="pressable text-xs text-red-500 px-2 py-1 rounded-lg hover:bg-red-50"
                    :disabled="busy"
                    @click="remove(m.userId)"
                  >
                    移除
                  </button>
                </div>
              </div>
            </div>

            <div v-if="addable.length">
              <div class="text-sm text-ink-600 mb-1">
                邀请好友（已选 {{ toAdd.length }}）
              </div>
              <div
                class="space-y-0.5 max-h-40 overflow-y-auto bg-ink-50 rounded-xl p-1"
              >
                <label
                  v-for="f in addable"
                  :key="f.id"
                  class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-brand"
                    :value="f.id"
                    v-model="toAdd"
                  />
                  <Avatar :user="f" size="sm" />
                  <span class="flex-1 truncate font-medium text-ink-800">
                    {{ f.nickname }}
                  </span>
                  <span class="text-[11px] text-ink-400 truncate">
                    @{{ f.username }}
                  </span>
                </label>
              </div>
              <button
                type="button"
                class="pressable mt-2 w-full py-2 rounded-xl bg-brand text-white text-sm font-medium disabled:opacity-50"
                :disabled="!toAdd.length || busy"
                @click="addMembers"
              >
                {{ busy ? "处理中…" : `邀请 ${toAdd.length} 人` }}
              </button>
            </div>

            <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
          </div>

          <div
            class="px-4 py-3 border-t border-black/5 flex justify-between"
          >
            <button
              type="button"
              class="pressable flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50"
              :disabled="busy"
              @click="leave"
            >
              <LogOut class="w-4 h-4" :stroke-width="1.75" />
              退出群聊
            </button>
            <button
              type="button"
              class="pressable px-4 py-2 rounded-xl bg-ink-100 text-sm text-ink-600"
              @click="$emit('close')"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { X, LogOut } from "lucide-vue-next";
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
