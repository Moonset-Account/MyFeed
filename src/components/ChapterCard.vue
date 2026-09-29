<script setup lang="ts">
import type { Chapter } from '../lib/types';

const props = defineProps<{ chapter: Chapter }>();
const emit = defineEmits<{ toggle: []; remove: [] }>();

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
void props;
</script>

<template>
  <div class="chapter-card" :class="{ done: chapter.completedAt !== null }">
    <div class="chapter-name">{{ chapter.name }}</div>
    <div class="chapter-meta">
      <span class="stars" :title="`熟练度 ${chapter.proficiency}/5`">{{ stars(chapter.proficiency) }}</span>
    </div>
    <div v-if="chapter.completedAt" class="chapter-done-at">已完成 · {{ chapter.completedAt }}</div>
    <div class="chapter-actions">
      <button type="button" class="btn small" @click="emit('toggle')">
        {{ chapter.completedAt ? '标记未完成' : '标记完成' }}
      </button>
      <button type="button" class="btn small danger" @click="emit('remove')">删除</button>
    </div>
  </div>
</template>
