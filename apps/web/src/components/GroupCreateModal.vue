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
            <h3 class="text-base font-semibold text-ink-800">发起群聊</h3>
            <button
              type="button"
              class="pressable w-8 h-8 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
              @click="$emit('close')"
            >
              <X class="w-4 h-4" :stroke-width="2" />
            </button>
          </div>

          <div class="p-4 space-y-3 flex-1 overflow-y-auto">
            <label class="block text-sm text-ink-600">
              群名称
              <input
                v-model="name"
                class="mt-1 w-full bg-ink-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20"
                maxlength="60"
                placeholder="最多 60 个字"
              />
            </label>

            <div>
              <div class="text-sm text-ink-600 mb-1">
                选择成员（已选 {{ selectedIds.length }}）
              </div>
              <div v-if="!chat.friends.length" class="text-xs text-ink-400">
                没有好友可以拉进群，先去通讯录加几个好友
              </div>
              <div
                class="space-y-0.5 max-h-64 overflow-y-auto bg-ink-50 rounded-xl p-1"
              >
                <label
                  v-for="f in chat.friends"
                  :key="f.id"
                  class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    class="w-4 h-4 accent-brand"
                    :value="f.id"
                    v-model="selectedIds"
                  />
                  <Avatar :user="f" size="sm" />
                  <span class="flex-1 truncate font-medium text-ink-800">
                    {{ f.nickname }}
                  </span>
                  <span class="text-xs text-ink-400 truncate">@{{ f.username }}</span>
                </label>
              </div>
            </div>

            <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
          </div>

          <div
            class="px-4 py-3 border-t border-black/5 flex justify-end gap-2"
          >
            <button
              type="button"
              class="pressable px-4 py-2 rounded-xl bg-ink-100 text-sm text-ink-600"
              @click="$emit('close')"
            >
              取消
            </button>
            <button
              type="button"
              class="pressable px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium disabled:opacity-50"
              :disabled="!canCreate || creating"
              @click="create"
            >
              {{ creating ? "创建中…" : "创建" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { X } from "lucide-vue-next";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";
import { useChatStore } from "../stores/chat";
import Avatar from "./Avatar.vue";
import type { GroupDetail } from "@im/shared";

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", group: GroupDetail): void;
}>();

const chat = useChatStore();
const name = ref("");
const selectedIds = ref<string[]>([]);
const creating = ref(false);
const error = ref("");

const canCreate = computed(
  () => name.value.trim().length > 0 && selectedIds.value.length > 0,
);

async function create() {
  error.value = "";
  if (!canCreate.value) return;
  creating.value = true;
  try {
    const group = await api.createGroup({
      name: name.value.trim(),
      memberIds: selectedIds.value,
    });
    await chat.refreshGroups();
    emit("created", group);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    creating.value = false;
  }
}
</script>
