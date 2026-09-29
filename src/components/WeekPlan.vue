<script setup lang="ts">
import { computed } from 'vue';
import { addDays, todayString } from '../lib/scheduler';

export interface ResolvedItem {
  courseName: string;
  chapterName: string;
}

const props = defineProps<{
  days: { date: string; items: ResolvedItem[] }[];
  absentDates: string[];
}>();

const weekDays = computed(() => {
  const today = todayString();
  // 以周一为一周起点
  const dow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const map = new Map(props.days.map((d) => [d.date, d.items]));
  const absent = new Set(props.absentDates);
  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return names.map((label, i) => {
    const date = addDays(monday, i);
    return {
      label,
      date,
      isToday: date === today,
      isAbsent: absent.has(date),
      items: map.get(date) ?? [],
    };
  });
});

function print(): void {
  window.print();
}
</script>

<template>
  <div class="week-plan" id="week-plan-print">
    <div class="week-header no-print">
      <button type="button" class="btn" @click="print">打印本周计划</button>
    </div>
    <h3 class="print-title">本周复习计划</h3>
    <div class="week-grid">
      <div
        v-for="day in weekDays"
        :key="day.date"
        class="week-day"
        :class="{ today: day.isToday, absent: day.isAbsent }"
      >
        <div class="week-day-head">
          <span class="week-day-label">{{ day.label }}</span>
          <span class="week-day-date">{{ day.date.slice(5) }}</span>
        </div>
        <p v-if="day.isAbsent" class="muted">缺席日</p>
        <ul v-else-if="day.items.length > 0" class="week-items">
          <li v-for="(item, i) in day.items" :key="i">
            <span class="item-course">{{ item.courseName }}</span>
            {{ item.chapterName }}
          </li>
        </ul>
        <p v-else class="muted">无安排</p>
      </div>
    </div>
  </div>
</template>
