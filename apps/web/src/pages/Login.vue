<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-white">
    <form
      class="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 space-y-5"
      @submit.prevent="onSubmit"
    >
      <div class="text-center">
        <div class="mx-auto w-12 h-12 rounded-2xl bg-brand flex items-center justify-center text-white text-2xl font-bold">
          IM
        </div>
        <h1 class="mt-3 text-xl font-semibold text-gray-800">登录 WhatsApp-IM</h1>
        <p class="mt-1 text-sm text-gray-500">像微信一样的聊天</p>
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">用户名</label>
        <input
          v-model="username"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="请输入用户名"
          autocomplete="username"
          required
        />
      </div>

      <div>
        <label class="block text-sm text-gray-600 mb-1">密码</label>
        <input
          v-model="password"
          type="password"
          class="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/50"
          placeholder="请输入密码"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full py-2 rounded-xl bg-brand text-white font-medium hover:bg-brand-600 disabled:opacity-60"
      >
        {{ loading ? "登录中…" : "登录" }}
      </button>

      <p class="text-center text-sm text-gray-500">
        还没账号？
        <RouterLink class="text-brand hover:underline" to="/register">去注册</RouterLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
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
