<template>
  <article class="bg-white rounded-2xl shadow-card px-4 py-4 flex gap-3">
    <Avatar :user="moment.author" size="md" />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium text-[#576b95]">
          {{ moment.author.nickname || moment.author.username }}
        </span>
        <span class="text-[11px] text-ink-400 ml-auto">
          {{ formatRelative(moment.createdAt) }}
        </span>
      </div>

      <p
        v-if="moment.content"
        class="mt-1 text-[15px] text-ink-800 whitespace-pre-wrap break-words leading-relaxed"
      >
        {{ moment.content }}
      </p>

      <!-- Image grid: 1 large / 2-4 two-col / 5-9 three-col (WeChat style) -->
      <div v-if="moment.images.length > 0" class="mt-2">
        <div
          v-if="moment.images.length === 1"
          class="rounded-xl overflow-hidden max-w-xs"
        >
          <img
            :src="moment.images[0]!.url"
            class="w-full max-h-80 object-cover cursor-pointer"
            loading="lazy"
            @click="openLightbox(0)"
          />
        </div>
        <div
          v-else
          class="grid gap-1"
          :class="
            moment.images.length <= 4 ? 'grid-cols-2 max-w-xs' : 'grid-cols-3 max-w-md'
          "
        >
          <img
            v-for="(img, i) in moment.images"
            :key="img.id"
            :src="img.url"
            class="aspect-square object-cover rounded-lg cursor-pointer"
            loading="lazy"
            @click="openLightbox(i)"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-3 flex items-center gap-5 text-sm text-ink-500">
        <button
          type="button"
          class="pressable flex items-center gap-1.5 disabled:opacity-50"
          :class="moment.likedByMe ? 'text-red-500' : 'hover:text-ink-700'"
          :disabled="liking"
          @click="onLike"
        >
          <Heart
            class="w-[18px] h-[18px]"
            :stroke-width="1.75"
            :fill="moment.likedByMe ? 'currentColor' : 'none'"
          />
          <span>{{ moment.likeCount }}</span>
        </button>
        <button
          type="button"
          class="pressable flex items-center gap-1.5 hover:text-ink-700"
          @click="toggleCommentBox"
        >
          <MessageCircle class="w-[18px] h-[18px]" :stroke-width="1.75" />
          <span>{{ moment.commentCount }}</span>
        </button>
        <button
          v-if="isMine"
          type="button"
          class="pressable ml-auto flex items-center gap-1 text-ink-400 hover:text-red-500"
          :disabled="deleting"
          @click="onDelete"
        >
          <Trash2 class="w-[16px] h-[16px]" :stroke-width="1.75" />
          <span>{{ deleting ? "删除中…" : "删除" }}</span>
        </button>
      </div>

      <!-- Like + comment list (WeChat-style grey block) -->
      <div
        v-if="moment.likes.length > 0 || moment.comments.length > 0"
        class="mt-2 bg-ink-100 rounded-xl px-3 py-2 text-sm"
      >
        <div
          v-if="moment.likes.length > 0"
          class="flex items-center gap-1 text-[#576b95] flex-wrap"
        >
          <Heart class="w-[13px] h-[13px] text-red-500" fill="currentColor" :stroke-width="0" />
          <template v-for="(u, i) in moment.likes" :key="u.id">
            <span>{{ u.nickname || u.username }}</span>
            <span v-if="i < moment.likes.length - 1" class="text-ink-400">、</span>
          </template>
        </div>
        <div
          v-if="moment.likes.length > 0 && moment.comments.length > 0"
          class="my-1.5 border-t border-black/5"
        ></div>
        <div
          v-for="c in moment.comments"
          :key="c.id"
          class="text-ink-800 break-words leading-relaxed"
        >
          <button
            type="button"
            class="text-[#576b95] hover:underline"
            @click="onReply(c.user.id, c.user.nickname || c.user.username)"
          >
            {{ c.user.nickname || c.user.username }}
          </button>
          <template v-if="c.replyToUser">
            <span class="text-ink-400"> 回复 </span>
            <span class="text-[#576b95]">
              {{ c.replyToUser.nickname || c.replyToUser.username }}
            </span>
          </template>
          <span>：{{ c.content }}</span>
          <button
            v-if="canDeleteComment(c.user.id)"
            type="button"
            class="ml-1 text-[11px] text-ink-400 hover:text-red-500"
            @click="onDeleteComment(c.id)"
          >
            删除
          </button>
        </div>
      </div>

      <!-- Comment input -->
      <Transition name="fade">
        <div
          v-if="showCommentBox"
          class="mt-2 flex items-center gap-2"
        >
          <input
            ref="commentInput"
            v-model="commentText"
            :placeholder="replyPlaceholder || '评论'"
            class="flex-1 bg-ink-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
            @keydown.enter.prevent="onSubmitComment"
          />
          <button
            type="button"
            class="pressable px-3 py-1.5 rounded-full bg-brand text-white text-sm disabled:opacity-50"
            :disabled="!commentText.trim() || sending"
            @click="onSubmitComment"
          >
            {{ sending ? "…" : "发送" }}
          </button>
          <button
            type="button"
            class="pressable text-ink-400 text-sm px-2"
            @click="closeCommentBox"
          >
            取消
          </button>
        </div>
      </Transition>
    </div>
  </article>

  <!-- Lightbox -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="lightboxIdx !== null"
        class="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        @click.self="closeLightbox"
      >
        <button
          type="button"
          class="pressable absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
          @click="closeLightbox"
        >
          <X class="w-5 h-5" :stroke-width="2" />
        </button>
        <img
          :src="moment.images[lightboxIdx]?.url ?? ''"
          class="max-w-full max-h-full object-contain"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { Heart, MessageCircle, Trash2, X } from "lucide-vue-next";
import Avatar from "./Avatar.vue";
import { useAuthStore } from "../stores/auth";
import { useMomentsStore } from "../stores/moments";
import { errorMessage } from "../api/http";
import { formatRelative } from "../utils/time";
import type { MomentDTO } from "@im/shared";

const props = defineProps<{
  moment: MomentDTO;
}>();

const auth = useAuthStore();
const store = useMomentsStore();

const showCommentBox = ref(false);
const commentText = ref("");
const replyToUserId = ref<string | null>(null);
const replyPlaceholder = ref("");
const commentInput = ref<HTMLInputElement | null>(null);
const liking = ref(false);
const sending = ref(false);
const deleting = ref(false);
const lightboxIdx = ref<number | null>(null);

const isMine = computed(() => auth.user?.id === props.moment.author.id);

function canDeleteComment(authorId: string): boolean {
  return auth.user?.id === authorId || isMine.value;
}

async function onLike() {
  if (liking.value) return;
  liking.value = true;
  try {
    await store.toggleLike(props.moment.id);
  } catch (e) {
    window.alert(errorMessage(e));
  } finally {
    liking.value = false;
  }
}

async function onDelete() {
  if (!window.confirm("确定删除这条动态？")) return;
  deleting.value = true;
  try {
    await store.remove(props.moment.id);
  } catch (e) {
    window.alert(errorMessage(e));
  } finally {
    deleting.value = false;
  }
}

function toggleCommentBox() {
  showCommentBox.value = !showCommentBox.value;
  if (!showCommentBox.value) {
    closeCommentBox();
    return;
  }
  replyToUserId.value = null;
  replyPlaceholder.value = "";
  void nextTick(() => commentInput.value?.focus());
}

function closeCommentBox() {
  showCommentBox.value = false;
  commentText.value = "";
  replyToUserId.value = null;
  replyPlaceholder.value = "";
}

function onReply(userId: string, name: string) {
  if (auth.user?.id === userId) {
    showCommentBox.value = true;
    replyToUserId.value = null;
    replyPlaceholder.value = "";
  } else {
    showCommentBox.value = true;
    replyToUserId.value = userId;
    replyPlaceholder.value = `回复 ${name}`;
  }
  void nextTick(() => commentInput.value?.focus());
}

async function onSubmitComment() {
  const text = commentText.value.trim();
  if (!text) return;
  sending.value = true;
  try {
    await store.addComment(
      props.moment.id,
      text,
      replyToUserId.value ?? undefined,
    );
    closeCommentBox();
  } catch (e) {
    window.alert(errorMessage(e));
  } finally {
    sending.value = false;
  }
}

async function onDeleteComment(commentId: string) {
  if (!window.confirm("删除这条评论？")) return;
  try {
    await store.removeComment(props.moment.id, commentId);
  } catch (e) {
    window.alert(errorMessage(e));
  }
}

function openLightbox(i: number) {
  lightboxIdx.value = i;
}
function closeLightbox() {
  lightboxIdx.value = null;
}
</script>
