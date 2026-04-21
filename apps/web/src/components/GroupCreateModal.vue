<template>
  <div
    class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
      <div class="px-4 py-3 border-b border-black/10 flex items-center justify-between">
        <h3 class="text-base font-semibold text-gray-800">发起群聊</h3>
        <button class="text-gray-400 hover:text-gray-600 text-xl leading-none" @click="$emit('close')">×</button>
      </div>

      <div class="p-4 space-y-3 flex-1 overflow-y-auto">
        <label class="block text-sm text-gray-600">
          群名称
          <input
            v-model="name"
            class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            maxlength="60"
            placeholder="最多 60 个字"
          />
        </label>

        <div>
          <div class="text-sm text-gray-600 mb-1">
            选择成员（已选 {{ selectedIds.length }}）
          </div>
          <div v-if="!chat.friends.length" class="text-xs text-gray-400">
            没有好友可以拉进群，先去通讯录加几个好友
          </div>
          <div class="space-y-1 max-h-64 overflow-y-auto border border-black/5 rounded-lg">
            <label
              v-for="f in chat.friends"
              :key="f.id"
              class="flex items-center gap-2 px-3 py-2 hover:bg-black/5 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                class="accent-brand"
                :value="f.id"
                v-model="selectedIds"
              />
              <span class="flex-1 truncate">{{ f.nickname }}</span>
              <span class="text-xs text-gray-400 truncate">@{{ f.username }}</span>
            </label>
          </div>
        </div>

        <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
      </div>

      <div class="px-4 py-3 border-t border-black/10 flex justify-end gap-2">
        <button
          class="px-3 py-1.5 rounded-lg bg-white border border-black/10 text-sm text-gray-600"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="px-4 py-1.5 rounded-lg bg-brand text-white text-sm disabled:opacity-50"
          :disabled="!canCreate || creating"
          @click="create"
        >
          {{ creating ? "创建中…" : "创建" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";
import { useChatStore } from "../stores/chat";
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
