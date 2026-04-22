<template>
  <div
    class="bg-white rounded-2xl shadow-card border border-black/5 p-2 max-w-[300px]"
  >
    <div class="grid grid-cols-8 gap-0.5 text-xl max-h-56 overflow-y-auto">
      <button
        v-for="e in EMOJIS"
        :key="e"
        type="button"
        class="pressable w-8 h-8 rounded-lg hover:bg-ink-100 flex items-center justify-center"
        @click="emit('pick', e)"
      >
        {{ e }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: "pick", emoji: string): void }>();

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
  "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
  "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜",
  "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐",
  "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
  "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
  "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳",
  "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮",
  "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰",
  "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓",
  "😩", "😫", "😤", "😡", "😠", "🤬", "😈", "👿",
  "💀", "☠️", "💩", "🤡", "👻", "👽", "🤖", "🎃",
  "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿",
  "😾", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤",
  "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗",
  "💖", "💘", "💝", "💟", "✨", "🎉", "🎊", "🎁",
  "👍", "👎", "👏", "🙌", "👐", "🤝", "🙏", "💪",
  "👀", "👃", "👂", "👄", "🧠", "🦷", "👶", "🧒",
];
</script>
