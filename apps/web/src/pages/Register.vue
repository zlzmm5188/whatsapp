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
          <UserPlus class="w-7 h-7" :stroke-width="2.25" />
        </div>
        <h1 class="mt-4 text-[22px] font-semibold text-ink-800">创建账号</h1>
        <p class="mt-1 text-sm text-ink-500">开始你的 IM 之旅</p>
      </div>

      <div>
        <label class="block text-sm text-ink-600 mb-1.5">用户名</label>
        <input
          v-model="username"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="3-32 位字母、数字、._-"
          autocomplete="username"
          required
        />
      </div>

      <div>
        <label class="block text-sm text-ink-600 mb-1.5">昵称</label>
        <input
          v-model="nickname"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="给自己起个名字"
          required
        />
      </div>

      <div>
        <label class="block text-sm text-ink-600 mb-1.5">邮箱（可选）</label>
        <input
          v-model="email"
          type="email"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>

      <div>
        <label class="block text-sm text-ink-600 mb-1.5">密码</label>
        <input
          v-model="password"
          type="password"
          class="w-full bg-ink-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
          placeholder="至少 6 位"
          autocomplete="new-password"
          required
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="pressable w-full py-2.5 rounded-xl bg-brand text-white font-medium shadow-bubble hover:bg-brand-600 disabled:opacity-60"
      >
        {{ loading ? "注册中…" : "注册" }}
      </button>

      <p class="text-center text-sm text-ink-500">
        已有账号？
        <RouterLink class="text-brand hover:underline" to="/login">
          去登录
        </RouterLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { UserPlus } from "lucide-vue-next";
import { useAuthStore } from "../stores/auth";
import { errorMessage } from "../api/http";

const username = ref("");
const nickname = ref("");
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const auth = useAuthStore();
const router = useRouter();

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.register({
      username: username.value.trim(),
      nickname: nickname.value.trim(),
      password: password.value,
      email: email.value.trim() || undefined,
    });
    router.replace("/");
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>
