<script setup lang="ts">
import { computed } from 'vue';
import type { Course } from '../lib/types';
import { courseProgress } from '../lib/scheduler';

const props = defineProps<{ courses: Course[] }>();

const rows = computed(() =>
  props.courses.map((c) => {
    const p = courseProgress(c);
    return { id: c.id, name: c.name, ...p };
  }),
);

const overall = computed(() => {
  const total = rows.value.reduce((s, r) => s + r.totalWeight, 0);
  const done = rows.value.reduce((s, r) => s + r.doneWeight, 0);
  return total === 0 ? 0 : Math.round((done / total) * 100);
});

const BAR_W = 320;
const BAR_H = 16;
</script>

<template>
  <div class="progress-chart">
    <p v-if="rows.length === 0" class="muted">还没有课程，添加课程后这里会显示进度。</p>
    <div v-for="row in rows" :key="row.id" class="progress-row">
      <div class="progress-label">
        <span class="progress-name">{{ row.name }}</span>
        <span class="muted">{{ row.doneChapters }}/{{ row.totalChapters }} 章 · {{ row.percent }}%</span>
      </div>
      <svg :width="BAR_W" :height="BAR_H" role="img" :aria-label="`${row.name} 进度 ${row.percent}%`">
        <rect x="0" y="0" :width="BAR_W" :height="BAR_H" rx="8" class="bar-bg" />
        <rect
          x="0"
          y="0"
          :width="(BAR_W * row.percent) / 100"
          :height="BAR_H"
          rx="8"
          class="bar-fill"
        />
      </svg>
    </div>
    <div v-if="rows.length > 0" class="progress-row overall">
      <div class="progress-label">
        <span class="progress-name">总进度</span>
        <span class="muted">{{ overall }}%</span>
      </div>
      <svg :width="BAR_W" :height="BAR_H" role="img" :aria-label="`总进度 ${overall}%`">
        <rect x="0" y="0" :width="BAR_W" :height="BAR_H" rx="8" class="bar-bg" />
        <rect x="0" y="0" :width="(BAR_W * overall) / 100" :height="BAR_H" rx="8" class="bar-fill overall-fill" />
      </svg>
    </div>
  </div>
</template>
