<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { Course } from '../lib/types';
import { courseProgress, diffDays, todayString } from '../lib/scheduler';
import ChapterCard from './ChapterCard.vue';

const props = defineProps<{ course: Course }>();
const emit = defineEmits<{
  addChapter: [name: string, proficiency: number];
  toggleChapter: [chapterId: string];
  removeChapter: [chapterId: string];
  removeCourse: [];
}>();

const form = reactive({ name: '', proficiency: 3 });

const progress = computed(() => courseProgress(props.course));
const daysLeft = computed(() => diffDays(todayString(), props.course.examDate));
const pendingCount = computed(
  () => props.course.chapters.filter((c) => c.completedAt === null).length,
);

function submit(): void {
  const name = form.name.trim();
  if (!name) return;
  emit('addChapter', name, form.proficiency);
  form.name = '';
  form.proficiency = 3;
}
</script>

<template>
  <section class="course-panel">
    <header class="course-head">
      <div>
        <h3>{{ course.name }}</h3>
        <p class="muted">
          考试日期 {{ course.examDate }} ·
          <template v-if="daysLeft > 0">还剩 {{ daysLeft }} 天</template>
          <template v-else-if="daysLeft === 0">今天考试</template>
          <template v-else>已过期 {{ -daysLeft }} 天</template>
          · 进度 {{ progress.percent }}%
        </p>
      </div>
      <button type="button" class="btn small danger" @click="emit('removeCourse')">删除课程</button>
    </header>

    <p v-if="daysLeft < 0 && pendingCount > 0" class="warning">
      考试日期已过，仍有 {{ pendingCount }} 章未完成，请修改考试日期或处理这些章节。
    </p>

    <form class="chapter-form no-print" @submit.prevent="submit">
      <input v-model="form.name" type="text" placeholder="章节名称，如：第 3 章 导数" required />
      <label>
        熟练度
        <select v-model.number="form.proficiency">
          <option :value="1">1 陌生</option>
          <option :value="2">2 了解</option>
          <option :value="3">3 一般</option>
          <option :value="4">4 较好</option>
          <option :value="5">5 熟练</option>
        </select>
      </label>
      <button type="submit" class="btn">添加章节</button>
    </form>

    <div v-if="course.chapters.length > 0" class="chapter-grid">
      <ChapterCard
        v-for="ch in course.chapters"
        :key="ch.id"
        :chapter="ch"
        @toggle="emit('toggleChapter', ch.id)"
        @remove="emit('removeChapter', ch.id)"
      />
    </div>
    <p v-else class="muted">还没有章节，先添加几章吧。</p>
  </section>
</template>
