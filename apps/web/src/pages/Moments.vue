<template>
  <div class="h-full flex flex-col bg-[#ededed]">
    <header
      class="px-4 py-3 bg-white border-b border-black/5 flex items-center gap-3"
    >
      <h1 class="text-lg font-medium">朋友圈</h1>
      <button
        type="button"
        class="ml-auto px-3 py-1.5 rounded-lg bg-brand text-white text-sm"
        @click="showComposer = !showComposer"
      >
        {{ showComposer ? "收起" : "发布" }}
      </button>
    </header>

    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
      <!-- Composer -->
      <section
        v-if="showComposer"
        class="bg-white border border-black/5 rounded-xl p-3"
      >
        <textarea
          v-model="newContent"
          rows="3"
          placeholder="这一刻的想法…"
          class="w-full resize-none bg-[#f7f7f7] rounded-lg px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/30"
        />

        <div
          v-if="pendingImages.length > 0"
          class="mt-2 grid grid-cols-3 gap-1 max-w-md"
        >
          <div
            v-for="(img, i) in pendingImages"
            :key="img.url"
            class="relative aspect-square"
          >
            <img
              :src="img.url"
              class="w-full h-full object-cover rounded"
            />
            <button
              type="button"
              class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
              @click="removePendingImage(i)"
              title="移除"
            >
              ×
            </button>
          </div>
          <button
            v-if="pendingImages.length < 9"
            type="button"
            class="aspect-square rounded border-2 border-dashed border-gray-300 text-gray-400 text-2xl hover:border-brand hover:text-brand"
            :disabled="uploading"
            @click="pickImage"
          >
            +
          </button>
        </div>

        <div v-if="composerError" class="mt-2 text-xs text-red-500">
          {{ composerError }}
        </div>

        <div class="mt-2 flex items-center gap-2">
          <button
            v-if="pendingImages.length === 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-[#f7f7f7] text-sm"
            :disabled="uploading"
            @click="pickImage"
          >
            🖼️ 添加图片
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="onFilesChange"
          />
          <span v-if="uploading" class="text-xs text-gray-400">上传中…</span>
          <div class="flex-1"></div>
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg bg-brand text-white text-sm disabled:opacity-50"
            :disabled="!canPost || posting"
            @click="onPost"
          >
            {{ posting ? "发布中…" : "发布" }}
          </button>
        </div>
      </section>

      <!-- Feed -->
      <div
        v-if="moments.loading && moments.timeline.length === 0"
        class="text-center text-gray-400 text-sm py-8"
      >
        加载中…
      </div>
      <div
        v-else-if="moments.timeline.length === 0"
        class="text-center text-gray-400 text-sm py-12"
      >
        还没有动态，发布第一条吧～
      </div>

      <MomentCard
        v-for="m in moments.timeline"
        :key="m.id"
        :moment="m"
      />

      <div
        v-if="moments.timeline.length > 0"
        class="text-center text-gray-400 text-xs py-4"
      >
        <button
          v-if="moments.hasMore"
          type="button"
          :disabled="moments.loading"
          class="px-3 py-1.5 rounded-lg bg-white border border-black/5"
          @click="moments.loadFeed(false)"
        >
          {{ moments.loading ? "加载中…" : "加载更多" }}
        </button>
        <span v-else>— 没有更多了 —</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MomentCard from "../components/MomentCard.vue";
import { useMomentsStore } from "../stores/moments";
import { api } from "../api/endpoints";
import { errorMessage } from "../api/http";

const moments = useMomentsStore();

const showComposer = ref(false);
const newContent = ref("");
const pendingImages = ref<{ url: string; name: string }[]>([]);
const uploading = ref(false);
const posting = ref(false);
const composerError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const scroller = ref<HTMLDivElement | null>(null);

const canPost = computed(
  () =>
    (newContent.value.trim().length > 0 || pendingImages.value.length > 0) &&
    !uploading.value,
);

onMounted(async () => {
  moments.bindSocket();
  if (moments.timeline.length === 0) {
    await moments.loadFeed(true);
  }
});

function pickImage() {
  fileInput.value?.click();
}

async function onFilesChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;
  composerError.value = "";

  const remaining = 9 - pendingImages.value.length;
  const selected = Array.from(files).slice(0, remaining);

  uploading.value = true;
  try {
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        composerError.value = `仅支持图片: ${file.name}`;
        continue;
      }
      const uploaded = await api.upload(file);
      pendingImages.value = [
        ...pendingImages.value,
        { url: uploaded.url, name: uploaded.name },
      ];
    }
  } catch (e) {
    composerError.value = errorMessage(e);
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function removePendingImage(i: number) {
  pendingImages.value = pendingImages.value.filter((_, idx) => idx !== i);
}

async function onPost() {
  if (!canPost.value || posting.value) return;
  posting.value = true;
  composerError.value = "";
  try {
    await moments.create(
      newContent.value.trim(),
      pendingImages.value.map((p) => p.url),
    );
    newContent.value = "";
    pendingImages.value = [];
    showComposer.value = false;
    scroller.value?.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    composerError.value = errorMessage(e);
  } finally {
    posting.value = false;
  }
}
</script>
