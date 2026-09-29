<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Chapter, Course, PersistedState } from './lib/types';
import { buildSchedule, todayString } from './lib/scheduler';
import { loadState, saveState } from './lib/storage';
import CoursePanel from './components/CoursePanel.vue';
import ProgressChart from './components/ProgressChart.vue';
import WeekPlan from './components/WeekPlan.vue';

const persisted = loadState();
const courses = ref<Course[]>(persisted?.courses ?? []);
const absentDates = ref<string[]>(persisted?.absentDates ?? []);

watch(
  [courses, absentDates],
  () => {
    const state: PersistedState = { courses: courses.value, absentDates: absentDates.value };
    saveState(state);
  },
  { deep: true },
);

const newCourse = reactive({ name: '', examDate: todayString() });
const newAbsentDate = ref(todayString());

function uid(): string {
  return crypto.randomUUID();
}

function addCourse(): void {
  const name = newCourse.name.trim();
  if (!name || !newCourse.examDate) return;
  courses.value.push({ id: uid(), name, examDate: newCourse.examDate, chapters: [] });
  newCourse.name = '';
}

function removeCourse(courseId: string): void {
  courses.value = courses.value.filter((c) => c.id !== courseId);
}

function findCourse(courseId: string): Course | undefined {
  return courses.value.find((c) => c.id === courseId);
}

function addChapter(courseId: string, name: string, proficiency: number): void {
  findCourse(courseId)?.chapters.push({
    id: uid(),
    name,
    proficiency,
    completedAt: null,
  });
}

function toggleChapter(courseId: string, chapterId: string): void {
  const ch = findCourse(courseId)?.chapters.find((c) => c.id === chapterId);
  if (!ch) return;
  ch.completedAt = ch.completedAt === null ? todayString() : null;
}

function removeChapter(courseId: string, chapterId: string): void {
  const course = findCourse(courseId);
  if (!course) return;
  course.chapters = course.chapters.filter((c) => c.id !== chapterId);
}

function addAbsent(): void {
  if (!newAbsentDate.value || absentDates.value.includes(newAbsentDate.value)) return;
  absentDates.value = [...absentDates.value, newAbsentDate.value].sort();
}

function removeAbsent(date: string): void {
  absentDates.value = absentDates.value.filter((d) => d !== date);
}

// 计划是派生数据：缺席日、完成状态变化后自动重排，完成记录始终保留在课程里。
const schedule = computed(() => buildSchedule(courses.value, todayString(), absentDates.value));

const resolvedSchedule = computed(() => {
  const chapterMap = new Map<string, { courseName: string; chapter: Chapter }>();
  for (const course of courses.value) {
    for (const ch of course.chapters) {
      chapterMap.set(ch.id, { courseName: course.name, chapter: ch });
    }
  }
  return schedule.value.map((day) => ({
    date: day.date,
    items: day.items
      .map((item) => {
        const found = chapterMap.get(item.chapterId);
        return found ? { courseName: found.courseName, chapterName: found.chapter.name } : null;
      })
      .filter((x): x is { courseName: string; chapterName: string } => x !== null),
  }));
});
</script>

<template>
  <div class="app">
    <header class="app-header no-print">
      <h1>课程复习计划本</h1>
      <p class="muted">数据保存在本机浏览器，无需账号。标记缺席或完成后，计划会自动重新安排。</p>
    </header>

    <main>
      <section class="card no-print">
        <h2>我的课程</h2>
        <form class="course-form" @submit.prevent="addCourse">
          <input v-model="newCourse.name" type="text" placeholder="课程名称，如：高等数学" required />
          <label>
            考试日期
            <input v-model="newCourse.examDate" type="date" required />
          </label>
          <button type="submit" class="btn primary">添加课程</button>
        </form>

        <CoursePanel
          v-for="course in courses"
          :key="course.id"
          :course="course"
          @add-chapter="(name, p) => addChapter(course.id, name, p)"
          @toggle-chapter="(id) => toggleChapter(course.id, id)"
          @remove-chapter="(id) => removeChapter(course.id, id)"
          @remove-course="removeCourse(course.id)"
        />
        <p v-if="courses.length === 0" class="muted">还没有课程，先添加一门吧。</p>
      </section>

      <section class="card no-print">
        <h2>缺席登记</h2>
        <p class="muted">临时缺席的日期不会安排复习，未完成的章节会自动顺延到之后的日期。</p>
        <form class="absent-form" @submit.prevent="addAbsent">
          <input v-model="newAbsentDate" type="date" required />
          <button type="submit" class="btn">标记缺席</button>
        </form>
        <ul v-if="absentDates.length > 0" class="absent-list">
          <li v-for="d in absentDates" :key="d">
            {{ d }}
            <button type="button" class="btn small" @click="removeAbsent(d)">移除</button>
          </li>
        </ul>
        <p v-else class="muted">暂无缺席记录。</p>
      </section>

      <section class="card no-print">
        <h2>每日复习计划</h2>
        <p v-if="resolvedSchedule.length === 0" class="muted">
          暂无待复习章节。添加课程和章节后，将按剩余天数与熟练度自动分配每日任务。
        </p>
        <div v-for="day in resolvedSchedule" :key="day.date" class="day-plan">
          <h3>{{ day.date }}</h3>
          <ul>
            <li v-for="(item, i) in day.items" :key="i">
              <span class="item-course">{{ item.courseName }}</span>
              {{ item.chapterName }}
            </li>
          </ul>
        </div>
      </section>

      <section class="card no-print">
        <h2>复习进度</h2>
        <ProgressChart :courses="courses" />
      </section>

      <section class="card week-card">
        <h2 class="no-print">周计划</h2>
        <WeekPlan :days="resolvedSchedule" :absent-dates="absentDates" />
      </section>
    </main>
  </div>
</template>
