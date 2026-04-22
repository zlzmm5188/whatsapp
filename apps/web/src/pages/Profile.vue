<template>
  <div class="h-full overflow-y-auto bg-ink-100">
    <!-- Header card -->
    <section
      class="bg-white shadow-card md:rounded-b-3xl pt-safe"
    >
      <div class="max-w-xl mx-auto px-6 pt-6 pb-5 flex items-center gap-4">
        <Avatar
          v-if="auth.user"
          :user="auth.user"
          size="lg"
          :online="true"
        />
        <div class="flex-1 min-w-0">
          <div class="text-[20px] font-semibold text-ink-800 truncate">
            {{ auth.user?.nickname }}
          </div>
          <div class="text-sm text-ink-500 truncate">@{{ auth.user?.username }}</div>
          <div v-if="auth.user?.bio" class="text-xs text-ink-400 mt-1 truncate">
            {{ auth.user.bio }}
          </div>
        </div>
      </div>
    </section>

    <!-- Form -->
    <div class="max-w-xl mx-auto px-4 md:px-6 py-4">
      <div class="bg-white rounded-2xl shadow-card p-4 md:p-5 space-y-4">
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-ink-700 mb-1.5">
            <User class="w-4 h-4 text-ink-400" :stroke-width="1.75" />
            昵称
          </label>
          <input
            v-model="form.nickname"
            class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-ink-700 mb-1.5">
            <ImageIcon class="w-4 h-4 text-ink-400" :stroke-width="1.75" />
            头像 URL
          </label>
          <input
            v-model="form.avatar"
            class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/20"
            placeholder="https://..."
          />
        </div>

        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-ink-700 mb-1.5">
            <PenLine class="w-4 h-4 text-ink-400" :stroke-width="1.75" />
            个性签名
          </label>
          <textarea
            v-model="form.bio"
            rows="3"
            class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
          />
        </div>

        <p
          v-if="feedback"
          class="text-sm"
          :class="feedbackError ? 'text-red-500' : 'text-brand-600'"
        >
          {{ feedback }}
        </p>

        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="pressable flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium shadow-bubble disabled:opacity-60"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </button>
          <button
            type="button"
            class="pressable flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-ink-100 text-ink-700 text-sm"
            @click="logout"
          >
            <LogOut class="w-4 h-4" :stroke-width="1.75" />
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
import {
  User,
  Image as ImageIcon,
  PenLine,
  LogOut,
} from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";
import { useMomentsStore } from "../stores/moments";
import { errorMessage } from "../api/http";
import Avatar from "../components/Avatar.vue";

const auth = useAuthStore();
const chat = useChatStore();
const moments = useMomentsStore();
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
  moments.reset();
  router.replace({ name: "login" });
}
</script>
