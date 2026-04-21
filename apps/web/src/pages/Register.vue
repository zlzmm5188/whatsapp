<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-white">
    <form
      class="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 space-y-5"
      @submit.prevent="onSubmit"
    >
      <div class="text-center">
        <h1 class="text-xl font-semibold text-gray-800">注册账号</h1>
        <p class="mt-1 text-sm text-gray-500">创建一个新的 WhatsApp-IM 账号</p>
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">用户名</label>
        <input
          v-model="username"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="3-32 位字母、数字、._-"
          autocomplete="username"
          required
        />
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">昵称</label>
        <input
          v-model="nickname"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="给自己起个名字"
          required
        />
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">邮箱（可选）</label>
        <input
          v-model="email"
          type="email"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">密码</label>
        <input
          v-model="password"
          type="password"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="至少 6 位"
          autocomplete="new-password"
          required
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2 rounded-xl bg-brand text-white font-medium hover:bg-brand-600 disabled:opacity-60"
      >
        {{ loading ? "注册中…" : "注册" }}
      </button>

      <p class="text-center text-sm text-gray-500">
        已有账号？
        <RouterLink class="text-brand hover:underline" to="/login">去登录</RouterLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
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
