<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ChapterCard from './components/ChapterCard.vue'
import ProgressChart from './components/ProgressChart.vue'
import WeekPlan from './components/WeekPlan.vue'
import { addDays, formatCN, todayISO } from './lib/dates'
import { applyCompletion, rescheduleCourse, undoLastCompletion } from './lib/mutations'
import { buildDayPlan, buildStudyPlan, buildWeekPlan, getChapterViews, getCourseStats } from './lib/planning'
import { clearSavedState, createId, loadState, saveState } from './lib/storage'
import type { Absence, Course, PlannerState, Proficiency } from './lib/types'

const state = reactive<PlannerState>(loadState())
const today = todayISO()
const chapterFilter = ref<'all' | 'active' | 'done'>('active')

const courseForm = reactive({
  name: '',
  examDate: addDays(today, 14),
  color: '#2563eb',
})

const chapterForm = reactive({
  courseId: '',
  title: '',
  proficiency: 3 as Proficiency,
})

const absenceForm = reactive({
  date: addDays(today, 1),
  reason: '',
})

const examEdit = reactive({
  courseId: '',
  date: '',
})

const plan = computed(() => buildStudyPlan(state, today))
const chapterViews = computed(() => getChapterViews(state, today))
const courseStats = computed(() => getCourseStats(state, today))
const todayPlan = computed(() => buildDayPlan(state, plan.value, today))
const week = computed(() => buildWeekPlan(state, plan.value, 7))
const overloadedCourses = computed(() => plan.value.coursePlans.filter((coursePlan) => coursePlan.overloaded))
const totalTodayMinutes = computed(() => todayPlan.value.minutes)

const filteredChapters = computed(() => {
  if (chapterFilter.value === 'active') return chapterViews.value.filter((view) => view.remainingUnits > 0)
  if (chapterFilter.value === 'done') return chapterViews.value.filter((view) => view.remainingUnits === 0)
  return chapterViews.value
})

watch(
  state,
  (value) => {
    saveState(value)
  },
  { deep: true },
)

function recordCount(chapterId: string): number {
  return state.records.filter((record) => record.chapterId === chapterId).length
}

function addCourse() {
  const name = courseForm.name.trim()
  if (!name || !courseForm.examDate) return
  const course: Course = {
    id: createId('course'),
    name,
    examDate: courseForm.examDate,
    color: courseForm.color,
  }
  state.courses.push(course)
  if (!chapterForm.courseId) chapterForm.courseId = course.id
  courseForm.name = ''
  courseForm.examDate = addDays(today, 14)
}

function removeCourse(courseId: string) {
  const chapterIds = new Set(state.chapters.filter((chapter) => chapter.courseId === courseId).map((chapter) => chapter.id))
  state.courses = state.courses.filter((course) => course.id !== courseId)
  state.chapters = state.chapters.filter((chapter) => chapter.courseId !== courseId)
  state.records = state.records.filter((record) => !chapterIds.has(record.chapterId))
  if (chapterForm.courseId === courseId) chapterForm.courseId = state.courses[0]?.id ?? ''
}

function addChapter() {
  const courseId = chapterForm.courseId || state.courses[0]?.id
  const title = chapterForm.title.trim()
  if (!courseId || !title) return
  state.chapters.push({
    id: createId('chapter'),
    courseId,
    title,
    order: state.chapters.filter((chapter) => chapter.courseId === courseId).length + 1,
    proficiency: chapterForm.proficiency,
    completedUnits: 0,
  })
  chapterForm.title = ''
}

function removeChapter(chapterId: string) {
  state.chapters = state.chapters.filter((chapter) => chapter.id !== chapterId)
  state.records = state.records.filter((record) => record.chapterId !== chapterId)
}

function completeChapter(chapterId: string) {
  applyCompletion(state, chapterId, today)
}

function undoChapter(chapterId: string) {
  undoLastCompletion(state, chapterId)
}

function startExamEdit(course: Course) {
  examEdit.courseId = course.id
  examEdit.date = course.examDate
}

function cancelExamEdit() {
  examEdit.courseId = ''
  examEdit.date = ''
}

function confirmExamEdit(courseId: string) {
  if (examEdit.courseId !== courseId || !examEdit.date) return
  const course = state.courses.find((item) => item.id === courseId)
  if (!course || course.examDate === examEdit.date) {
    cancelExamEdit()
    return
  }
  rescheduleCourse(state, courseId, examEdit.date)
  cancelExamEdit()
}

function updateProficiency(chapterId: string, proficiency: Proficiency) {
  const chapter = state.chapters.find((item) => item.id === chapterId)
  if (chapter) chapter.proficiency = proficiency
}

function addAbsence() {
  if (!absenceForm.date || state.absences.some((absence) => absence.date === absenceForm.date)) return
  const absence: Absence = {
    id: createId('absence'),
    date: absenceForm.date,
    reason: absenceForm.reason.trim(),
  }
  state.absences.push(absence)
  state.absences.sort((a, b) => a.date.localeCompare(b.date))
  absenceForm.reason = ''
  absenceForm.date = addDays(today, 1)
}

function removeAbsence(absenceId: string) {
  state.absences = state.absences.filter((absence) => absence.id !== absenceId)
}

function resetSample() {
  clearSavedState()
  Object.assign(state, loadState())
  chapterFilter.value = 'active'
}

function clearAll() {
  const empty: PlannerState = { version: 1, courses: [], chapters: [], records: [], absences: [] }
  Object.assign(state, empty)
  chapterForm.courseId = ''
}

function printWeek() {
  window.print()
}
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Offline Study Planner</p>
        <h1>课程复习计划本</h1>
        <p>录入课程、考试日期、章节和熟练度，系统会按剩余学习日自动拆分每日复习量。数据只保存在本机浏览器中。</p>
      </div>
      <div class="hero-date">
        <span>今天</span>
        <strong>{{ formatCN(today) }}</strong>
      </div>
    </header>

    <section class="today-strip" aria-label="今日复习概览">
      <div>
        <span>今日任务</span>
        <strong>{{ todayPlan.totalUnits }} 块 · {{ totalTodayMinutes }} 分钟</strong>
      </div>
      <div>
        <span>待复习章节</span>
        <strong>{{ chapterViews.filter((view) => view.remainingUnits > 0).length }} 章</strong>
      </div>
      <div>
        <span>已完成记录</span>
        <strong>{{ state.records.length }} 条</strong>
      </div>
      <div>
        <span>缺席日期</span>
        <strong>{{ state.absences.length }} 天</strong>
      </div>
    </section>

    <div v-if="overloadedCourses.length" class="warning-banner">
      <strong>时间偏紧：</strong>
      {{ overloadedCourses.map((item) => item.course.name).join('、') }} 的剩余复习块多于可用学习日，建议提前开始或每天增加复习块。
    </div>

    <div v-if="plan.overdueChapters.length" class="warning-banner">
      <strong>需要追赶：</strong>
      {{ plan.overdueChapters.length }} 个章节已经没有可用复习日，请降低熟练度目标、补记完成情况，或尽快安排额外复习。
    </div>

    <section class="panel today-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Today</p>
          <h2>今天复习什么</h2>
        </div>
      </div>
      <div v-if="todayPlan.absence" class="absence-banner">
        今天标记为缺席（{{ todayPlan.absence.reason || '临时安排' }}），未完成章节已重新铺到后续学习日。
      </div>
      <div v-else-if="todayPlan.items.length" class="today-list">
        <article v-for="item in todayPlan.items" :key="item.chapter.id" class="today-item">
          <span class="color-dot" :style="{ background: item.course.color }"></span>
          <div>
            <strong>{{ item.course.name }} · {{ item.chapter.title }}</strong>
            <p>{{ item.units }} 个复习块 / {{ item.units * 30 }} 分钟</p>
          </div>
          <button class="primary-button small" type="button" @click="completeChapter(item.chapter.id)">完成一块</button>
        </article>
      </div>
      <p v-else class="empty-inline">今天没有安排；可提前查看周计划，或等待缺席日后的自动顺延。</p>
    </section>

    <ProgressChart :stats="courseStats" :week="week" />

    <section class="panel forms-grid">
      <form class="form-card" @submit.prevent="addCourse">
        <p class="eyebrow">Course</p>
        <h2>添加课程</h2>
        <label>课程名称<input v-model="courseForm.name" required placeholder="例如：数据结构" /></label>
        <label>考试日期<input v-model="courseForm.examDate" required type="date" :min="today" /></label>
        <label>标签颜色<input v-model="courseForm.color" type="color" /></label>
        <button class="primary-button" type="submit" :disabled="!courseForm.name.trim()">添加课程</button>
      </form>

      <form class="form-card" @submit.prevent="addChapter">
        <p class="eyebrow">Chapter</p>
        <h2>添加章节</h2>
        <label>所属课程
          <select v-model="chapterForm.courseId" required>
            <option value="" disabled>请选择课程</option>
            <option v-for="course in state.courses" :key="course.id" :value="course.id">{{ course.name }} · {{ formatCN(course.examDate) }}</option>
          </select>
        </label>
        <label>章节名称<input v-model="chapterForm.title" required placeholder="例如：线性表、栈与队列" /></label>
        <label>当前熟练度
          <select v-model.number="chapterForm.proficiency">
            <option :value="1">1 · 生疏</option>
            <option :value="2">2 · 需巩固</option>
            <option :value="3">3 · 基本掌握</option>
            <option :value="4">4 · 较熟练</option>
            <option :value="5">5 · 有把握</option>
          </select>
        </label>
        <button class="primary-button" type="submit" :disabled="!state.courses.length || !chapterForm.title.trim()">添加章节</button>
      </form>

      <form class="form-card" @submit.prevent="addAbsence">
        <p class="eyebrow">Absence</p>
        <h2>临时缺席</h2>
        <label>缺席日期<input v-model="absenceForm.date" required type="date" :min="today" /></label>
        <label>原因（可选）<input v-model="absenceForm.reason" placeholder="社团活动 / 身体不适" /></label>
        <button class="primary-button" type="submit" :disabled="!absenceForm.date">加入缺席日</button>
        <ul v-if="state.absences.length" class="absence-list">
          <li v-for="absence in state.absences" :key="absence.id">
            <span>{{ formatCN(absence.date) }}{{ absence.reason ? ` · ${absence.reason}` : '' }}</span>
            <button type="button" @click="removeAbsence(absence.id)">移除</button>
          </li>
        </ul>
      </form>
    </section>

    <section class="panel courses-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Courses</p>
          <h2>课程清单</h2>
        </div>
      </div>
      <div v-if="state.courses.length" class="course-list">
        <article v-for="stat in courseStats" :key="stat.course.id" class="course-pill">
          <span class="color-dot" :style="{ background: stat.course.color }"></span>
          <div>
            <strong>{{ stat.course.name }}</strong>
            <small v-if="examEdit.courseId !== stat.course.id">
              {{ formatCN(stat.course.examDate) }} · {{ stat.chapterCount }} 章 · 完成 {{ stat.completedUnits }}/{{ stat.totalUnits }} 块
            </small>
            <div v-else class="exam-edit">
              <label>
                新考试日期
                <input v-model="examEdit.date" type="date" :min="today" :aria-label="`${stat.course.name} 新的考试日期`" />
              </label>
              <div class="exam-edit__actions">
                <button class="primary-button small" type="button" :disabled="!examEdit.date" @click="confirmExamEdit(stat.course.id)">确认改期</button>
                <button class="secondary-button small" type="button" @click="cancelExamEdit">取消</button>
              </div>
              <p class="exam-edit__hint">确认后只按新的剩余天数重算未完成复习块；已完成记录、熟练度和缺席日都会保留。</p>
            </div>
          </div>
          <div class="course-pill__actions">
            <button
              v-if="examEdit.courseId !== stat.course.id"
              class="link-button"
              type="button"
              @click="startExamEdit(stat.course)"
            >改期</button>
            <button class="link-button danger" type="button" @click="removeCourse(stat.course.id)">删除</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-inline">还没有课程，先添加一门考试课程。</p>
    </section>

    <section class="panel chapters-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Chapters</p>
          <h2>章节卡片</h2>
        </div>
        <div class="segmented" role="group" aria-label="章节筛选">
          <button :class="{ active: chapterFilter === 'active' }" type="button" @click="chapterFilter = 'active'">待复习</button>
          <button :class="{ active: chapterFilter === 'done' }" type="button" @click="chapterFilter = 'done'">已完成</button>
          <button :class="{ active: chapterFilter === 'all' }" type="button" @click="chapterFilter = 'all'">全部</button>
        </div>
      </div>
      <div v-if="filteredChapters.length" class="chapter-grid">
        <ChapterCard
          v-for="view in filteredChapters"
          :key="view.chapter.id"
          :view="view"
          :can-undo="recordCount(view.chapter.id) > 0"
          @complete="completeChapter"
          @undo="undoChapter"
          @remove="removeChapter"
          @proficiency="updateProficiency($event.chapterId, $event.proficiency)"
        />
      </div>
      <p v-else class="empty-inline">没有匹配的章节。</p>
    </section>

    <WeekPlan :week="week" @print="printWeek" />

    <section class="danger-zone">
      <button class="secondary-button" type="button" @click="resetSample">恢复示例数据</button>
      <button class="secondary-button danger" type="button" @click="clearAll">清空全部数据</button>
      <p>无需账号或网络连接；清理浏览器站点数据会删除本计划。</p>
    </section>

    <div class="print-area" aria-hidden="true">
      <h1>课程复习周计划</h1>
      <WeekPlan :week="week" printable />
    </div>
  </main>
</template>
