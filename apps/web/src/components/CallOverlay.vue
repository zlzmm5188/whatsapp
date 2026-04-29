<template>
  <Teleport to="body">
    <Transition name="call-fade">
      <div
        v-if="call.inCall"
        class="fixed inset-0 z-[100] bg-ink-900 text-white flex flex-col select-none"
        :class="{ 'cursor-default': true }"
      >
        <!-- Remote video fills viewport when video call & connected -->
        <video
          v-show="isVideo && call.status === 'active'"
          ref="remoteVideoEl"
          class="absolute inset-0 w-full h-full object-cover bg-black"
          autoplay
          playsinline
        />
        <audio v-show="!isVideo" ref="remoteAudioEl" autoplay playsinline />

        <!-- Local PIP (video only) -->
        <video
          v-show="isVideo && call.status !== 'idle' && call.localStream"
          ref="localVideoEl"
          class="absolute top-3 right-3 w-24 h-32 md:w-32 md:h-40 rounded-2xl object-cover bg-ink-800 border border-white/10 shadow-bubble"
          :class="{
            'opacity-50': call.cameraOff,
          }"
          autoplay
          playsinline
          muted
        />

        <!-- Top: peer info + status text -->
        <div
          class="relative z-10 px-6 pt-safe pt-8 text-center"
          :class="
            isVideo && call.status === 'active'
              ? 'bg-gradient-to-b from-black/60 to-transparent pb-12'
              : ''
          "
        >
          <Avatar
            v-if="call.peer && (!isVideo || call.status !== 'active')"
            :user="call.peer"
            size="xl"
            class="mx-auto mb-4 ring-4 ring-white/10"
          />
          <div class="text-2xl font-medium">
            {{ call.peer?.nickname || "未知用户" }}
          </div>
          <div class="mt-1 text-sm text-white/70 h-5">
            <template v-if="call.status === 'incoming'">
              {{ isVideo ? "邀请你视频通话" : "邀请你语音通话" }}
            </template>
            <template v-else-if="call.status === 'outgoing'">
              正在呼叫…
            </template>
            <template v-else-if="call.status === 'connecting'">
              正在连接…
            </template>
            <template v-else-if="call.status === 'active'">
              {{ formatElapsed(elapsed) }}
            </template>
          </div>
          <div
            v-if="call.errorMessage"
            class="mt-2 text-xs text-rose-300"
          >
            {{ call.errorMessage }}
          </div>
        </div>

        <div class="flex-1"></div>

        <!-- Bottom controls -->
        <div
          class="relative z-10 pb-safe px-8 pb-10"
          :class="
            isVideo && call.status === 'active'
              ? 'bg-gradient-to-t from-black/70 to-transparent pt-12'
              : ''
          "
        >
          <!-- Incoming: accept / reject -->
          <div
            v-if="call.status === 'incoming'"
            class="flex items-center justify-around max-w-sm mx-auto"
          >
            <button
              type="button"
              class="pressable w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-bubble"
              :title="'拒接'"
              @click="call.reject"
            >
              <PhoneOff class="w-7 h-7" :stroke-width="2.25" />
            </button>
            <button
              type="button"
              class="pressable w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-bubble"
              :title="'接听'"
              @click="call.accept"
            >
              <Phone class="w-7 h-7" :stroke-width="2.25" />
            </button>
          </div>

          <!-- Outgoing / connecting: cancel only -->
          <div
            v-else-if="
              call.status === 'outgoing' || call.status === 'connecting'
            "
            class="flex items-center justify-center"
          >
            <button
              type="button"
              class="pressable w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-bubble"
              :title="'取消'"
              @click="call.hangup"
            >
              <PhoneOff class="w-7 h-7" :stroke-width="2.25" />
            </button>
          </div>

          <!-- Active: mute / camera / hangup -->
          <div
            v-else-if="call.status === 'active'"
            class="flex items-center justify-center gap-6 max-w-sm mx-auto"
          >
            <button
              type="button"
              class="pressable w-14 h-14 rounded-full flex items-center justify-center transition-colors"
              :class="
                call.muted
                  ? 'bg-white text-ink-900'
                  : 'bg-white/10 hover:bg-white/20'
              "
              :title="call.muted ? '取消静音' : '静音'"
              @click="call.toggleMute"
            >
              <Mic v-if="!call.muted" class="w-6 h-6" :stroke-width="2" />
              <MicOff v-else class="w-6 h-6" :stroke-width="2" />
            </button>

            <button
              type="button"
              class="pressable w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-bubble"
              :title="'挂断'"
              @click="call.hangup"
            >
              <PhoneOff class="w-7 h-7" :stroke-width="2.25" />
            </button>

            <button
              v-if="isVideo"
              type="button"
              class="pressable w-14 h-14 rounded-full flex items-center justify-center transition-colors"
              :class="
                call.cameraOff
                  ? 'bg-white text-ink-900'
                  : 'bg-white/10 hover:bg-white/20'
              "
              :title="call.cameraOff ? '开启摄像头' : '关闭摄像头'"
              @click="call.toggleCamera"
            >
              <Video v-if="!call.cameraOff" class="w-6 h-6" :stroke-width="2" />
              <VideoOff v-else class="w-6 h-6" :stroke-width="2" />
            </button>
            <!-- spacer keeps hangup centered for audio calls -->
            <div v-else class="w-14 h-14"></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-vue-next";
import Avatar from "./Avatar.vue";
import { useCallStore } from "../stores/call";

const call = useCallStore();

const remoteVideoEl = ref<HTMLVideoElement | null>(null);
const remoteAudioEl = ref<HTMLAudioElement | null>(null);
const localVideoEl = ref<HTMLVideoElement | null>(null);

const isVideo = computed(() => call.kind === "video");

// Bind remote MediaStream to <video>/<audio> when it changes.
watch(
  () => call.remoteStream,
  (stream) => {
    if (remoteVideoEl.value) remoteVideoEl.value.srcObject = stream ?? null;
    if (remoteAudioEl.value) remoteAudioEl.value.srcObject = stream ?? null;
  },
);

watch(
  () => call.localStream,
  (stream) => {
    if (localVideoEl.value) localVideoEl.value.srcObject = stream ?? null;
  },
);

// In case the elements mount AFTER the streams are already set (e.g. when
// the overlay first opens), rebind on element-ref changes too.
watch(remoteVideoEl, (el) => {
  if (el) el.srcObject = call.remoteStream ?? null;
});
watch(remoteAudioEl, (el) => {
  if (el) el.srcObject = call.remoteStream ?? null;
});
watch(localVideoEl, (el) => {
  if (el) el.srcObject = call.localStream ?? null;
});

// Live elapsed-seconds counter for the active state.
const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

watch(
  () => call.startedAt,
  (started) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (started) {
      elapsed.value = Math.floor((Date.now() - started) / 1000);
      timer = setInterval(() => {
        elapsed.value = Math.floor((Date.now() - started) / 1000);
      }, 1000);
    } else {
      elapsed.value = 0;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

function formatElapsed(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
</script>

<style scoped>
.call-fade-enter-active,
.call-fade-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.call-fade-enter-from,
.call-fade-leave-to {
  opacity: 0;
}
</style>
