<script setup lang="ts">
import { formatCN, relativeDayLabel, weekdayCN } from '../lib/dates'
import type { DayPlan } from '../lib/types'

defineProps<{
  week: DayPlan[]
  printable?: boolean
}>()

const emit = defineEmits<{ print: [] }>()
</script>

<template>
  <section :class="['week-plan', { 'week-plan--print': printable }]">
    <header class="week-plan__header">
      <div>
        <p class="eyebrow">Weekly Plan</p>
        <h2>未来 7 天周计划</h2>
      </div>
      <button v-if="!printable" class="secondary-button" type="button" @click="emit('print')">
        打印周计划
      </button>
    </header>

    <p v-if="printable" class="print-meta">课程复习计划本 · 打印日期：{{ week[0]?.date ?? '' }}</p>

    <div class="week-grid">
      <article v-for="day in week" :key="day.date" :class="['day-card', { 'day-card--absence': day.absence, 'day-card--exam': day.examCourses.length > 0 }]">
        <header>
          <div>
            <strong>{{ formatCN(day.date) }} {{ weekdayCN(day.date) }}</strong>
            <span v-if="!printable">{{ relativeDayLabel(day.date, week[0]?.date ?? day.date) }}</span>
          </div>
          <b>{{ day.minutes }} 分钟</b>
        </header>

        <div v-if="day.examCourses.length" class="exam-badge">
          考试：{{ day.examCourses.map((course) => course.name).join('、') }}
        </div>
        <div v-if="day.absence" class="absence-badge">
          缺席：{{ day.absence.reason || '临时安排' }}
        </div>

        <ul v-if="day.items.length">
          <li v-for="item in day.items" :key="item.chapter.id">
            <span class="color-dot" :style="{ background: item.course.color }"></span>
            <div>
              <strong>{{ item.course.name }} · {{ item.chapter.title }}</strong>
              <small>{{ item.units }} 块 / {{ item.units * 30 }} 分钟</small>
            </div>
          </li>
        </ul>
        <p v-else class="muted">{{ day.absence ? '不安排复习，任务将顺延' : '无安排' }}</p>
      </article>
    </div>
  </section>
</template>
