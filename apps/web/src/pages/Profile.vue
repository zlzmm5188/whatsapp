<template>
  <div class="h-full overflow-y-auto bg-white">
    <div class="max-w-md mx-auto p-6 md:p-10">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">我的资料</h2>

      <div v-if="auth.user" class="space-y-5">
        <div class="flex items-center gap-4">
          <Avatar :user="auth.user" size="lg" :online="true" />
          <div>
            <div class="text-lg font-medium text-gray-800">{{ auth.user.nickname }}</div>
            <div class="text-sm text-gray-500">@{{ auth.user.username }}</div>
          </div>
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">昵称</label>
          <input
            v-model="form.nickname"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">头像 URL</label>
          <input
            v-model="form.avatar"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            placeholder="https://..."
          />
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">个性签名</label>
          <textarea
            v-model="form.bio"
            rows="3"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />
        </div>

        <p v-if="feedback" class="text-sm" :class="feedbackError ? 'text-red-500' : 'text-green-600'">
          {{ feedback }}
        </p>

        <div class="flex gap-2">
          <button
            class="px-4 py-2 rounded-xl bg-brand text-white text-sm"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </button>
          <button
            class="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm"
            @click="logout"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import { errorMessage } from "../api/http";
import Avatar from "../components/Avatar.vue";

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();

const form = reactive({
  nickname: auth.user?.nickname ?? "",
  avatar: auth.user?.avatar ?? "",
  bio: auth.user?.bio ?? "",
});
const saving = ref(false);
const feedback = ref("");
const feedbackError = ref(false);

watch(
  () => auth.user,
  (u) => {
    if (u) {
      form.nickname = u.nickname;
      form.avatar = u.avatar ?? "";
      form.bio = u.bio ?? "";
    }
  },
);

async function save() {
  saving.value = true;
  feedback.value = "";
  try {
    // nickname is required on the server; only send it when non-empty.
    // For bio/avatar, map "" -> null so the server clears the stored value
    // (Prisma: null = set to null, undefined = skip).
    await auth.updateProfile({
      nickname: form.nickname.trim() || undefined,
      avatar: form.avatar.trim() === "" ? null : form.avatar.trim(),
      bio: form.bio.trim() === "" ? null : form.bio.trim(),
    });
    feedback.value = "已保存";
    feedbackError.value = false;
  } catch (err) {
    feedback.value = errorMessage(err);
    feedbackError.value = true;
  } finally {
    saving.value = false;
  }
}

function logout() {
  auth.logout();
  chat.reset();
  router.replace({ name: "login" });
}
</script>
