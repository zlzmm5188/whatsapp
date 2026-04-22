<template>
  <div class="h-full flex flex-col bg-ink-100">
    <header
      class="flex items-center gap-3 px-4 h-14 bg-glass border-b border-black/5 pt-safe"
    >
      <h1 class="text-[22px] font-semibold tracking-tight text-ink-800">
        朋友圈
      </h1>
      <button
        type="button"
        class="pressable ml-auto w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shadow-bubble"
        :title="showComposer ? '收起' : '发布动态'"
        @click="showComposer = !showComposer"
      >
        <component
          :is="showComposer ? X : Camera"
          class="w-[18px] h-[18px]"
          :stroke-width="2"
        />
      </button>
    </header>

    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-3 pb-6">
      <!-- Composer -->
      <Transition name="fade">
        <section
          v-if="showComposer"
          class="bg-white rounded-2xl shadow-card p-3"
        >
          <textarea
            v-model="newContent"
            rows="3"
            placeholder="这一刻的想法…"
            class="w-full resize-none bg-ink-100 rounded-xl px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand/20"
          />

          <div
            v-if="pendingImages.length > 0"
            class="mt-2 grid grid-cols-3 gap-1.5 max-w-md"
          >
            <div
              v-for="(img, i) in pendingImages"
              :key="img.url"
              class="relative aspect-square group"
            >
              <img
                :src="img.url"
                class="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                class="pressable absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                title="移除"
                @click="removePendingImage(i)"
              >
                <X class="w-3.5 h-3.5" :stroke-width="2.25" />
              </button>
            </div>
            <button
              v-if="pendingImages.length < 9"
              type="button"
              class="pressable aspect-square rounded-lg border border-dashed border-ink-300 text-ink-400 flex items-center justify-center hover:border-brand hover:text-brand"
              :disabled="uploading"
              @click="pickImage"
            >
              <Plus class="w-6 h-6" :stroke-width="1.75" />
            </button>
          </div>

          <div v-if="composerError" class="mt-2 text-xs text-red-500">
            {{ composerError }}
          </div>

          <div class="mt-3 flex items-center gap-2">
            <button
              v-if="pendingImages.length === 0"
              type="button"
              class="pressable flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ink-100 text-sm text-ink-700"
              :disabled="uploading"
              @click="pickImage"
            >
              <ImageIcon class="w-4 h-4" :stroke-width="1.75" />
              <span>添加图片</span>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="onFilesChange"
            />
            <span v-if="uploading" class="text-xs text-ink-400">上传中…</span>
            <div class="flex-1"></div>
            <button
              type="button"
              class="pressable px-4 py-1.5 rounded-xl bg-brand text-white text-sm disabled:opacity-50"
              :disabled="!canPost || posting"
              @click="onPost"
            >
              {{ posting ? "发布中…" : "发布" }}
            </button>
          </div>
        </section>
      </Transition>

      <!-- Feed -->
      <div
        v-if="moments.loading && moments.timeline.length === 0"
        class="text-center text-ink-400 text-sm py-12"
      >
        加载中…
      </div>
      <div
        v-else-if="moments.timeline.length === 0"
        class="text-center text-ink-400 text-sm py-16"
      >
        还没有动态<br />
        <span class="text-xs">发布第一条吧～</span>
      </div>

      <TransitionGroup name="moment" tag="div" class="space-y-3">
        <MomentCard
          v-for="m in moments.timeline"
          :key="m.id"
          :moment="m"
        />
      </TransitionGroup>

      <div
        v-if="moments.timeline.length > 0"
        class="text-center text-ink-400 text-xs py-4"
      >
        <button
          v-if="moments.hasMore"
          type="button"
          :disabled="moments.loading"
          class="pressable px-4 py-1.5 rounded-xl bg-white shadow-bubble"
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
import { Camera, X, Plus, Image as ImageIcon } from "lucide-vue-next";
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
