<template>
  <div
    class="bg-white border border-black/10 rounded-xl shadow-lg p-2 max-w-[280px]"
  >
    <div class="grid grid-cols-8 gap-0.5 text-xl max-h-56 overflow-y-auto">
      <button
        v-for="e in EMOJIS"
        :key="e"
        type="button"
        class="w-8 h-8 hover:bg-black/5 rounded"
        @click="emit('pick', e)"
      >
        {{ e }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: "pick", emoji: string): void }>();

// A curated list — keeping it compact so the panel stays light.
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
