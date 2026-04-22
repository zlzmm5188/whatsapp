<template>
  <div
    class="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 via-white to-ink-50"
  >
    <form
      class="w-full max-w-sm bg-white rounded-3xl shadow-card p-7 md:p-8 space-y-5"
      @submit.prevent="onSubmit"
    >
      <div class="text-center">
        <div
          class="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-700 flex items-center justify-center text-white shadow-bubble"
        >
          <MessageCircle class="w-7 h-7" :stroke-width="2.25" />
        </div>
        <h1 class="mt-4 text-[22px] font-semibold text-ink-800">欢迎回来</h1>
        <p class="mt-1 text-sm text-ink-500">登录 WhatsApp-IM</p>
      </div>

      <div>
        <label class="flex items-center gap-2 text-sm text-ink-600 mb-1.5">
          <User class="w-4 h-4 text-ink-400" :stroke-width="1.75" />
          用户名
        </label>
        <input
          v-model="username"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="请输入用户名"
          autocomplete="username"
          required
        />
      </div>

      <div>
        <label class="flex items-center gap-2 text-sm text-ink-600 mb-1.5">
          <Lock class="w-4 h-4 text-ink-400" :stroke-width="1.75" />
          密码
        </label>
        <input
          v-model="password"
          type="password"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="请输入密码"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="pressable w-full py-2.5 rounded-xl bg-brand text-white font-medium shadow-bubble hover:bg-brand-600 disabled:opacity-60"
      >
        {{ loading ? "登录中…" : "登录" }}
      </button>

      <p class="text-center text-sm text-ink-500">
        还没账号？
        <RouterLink class="text-brand hover:underline" to="/register">
          去注册
        </RouterLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { MessageCircle, User, Lock } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { errorMessage } from "../api/http";

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(username.value.trim(), password.value);
    const next = (route.query.next as string | undefined) ?? "/";
    router.replace(next);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>
