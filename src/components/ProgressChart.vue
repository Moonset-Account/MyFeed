<script setup lang="ts">
import { computed } from 'vue'
import { formatCN, weekdayCN } from '../lib/dates'
import { MINUTES_PER_UNIT } from '../lib/planning'
import type { CourseStat, DayPlan } from '../lib/types'

const props = defineProps<{
  stats: CourseStat[]
  week: DayPlan[]
}>()

const maxMinutes = computed(() => Math.max(60, ...props.week.map((day) => day.minutes)))
const chartWidth = 680
const chartHeight = 210
const left = 42
const bottom = 38
const top = 20
const innerWidth = chartWidth - left - 18
const innerHeight = chartHeight - top - bottom

const points = computed(() => {
  const stepX = props.week.length > 1 ? innerWidth / (props.week.length - 1) : 0
  return props.week.map((day, index) => {
    const x = left + stepX * index
    const y = top + innerHeight - (day.minutes / maxMinutes.value) * innerHeight
    return { x, y, day }
  })
})

const linePath = computed(() =>
  points.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
)
</script>

<template>
  <section class="panel chart-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Progress</p>
        <h2>复习进度图</h2>
      </div>
    </div>

    <div v-if="stats.length === 0" class="empty-state">
      添加课程后，这里会显示总进度和未来 7 天的复习负荷。
    </div>

    <template v-else>
      <div class="course-bars" aria-label="课程完成进度">
        <div v-for="stat in stats" :key="stat.course.id" class="course-bar-row">
          <div class="course-bar-meta">
            <span><i :style="{ background: stat.course.color }"></i>{{ stat.course.name }}</span>
            <strong>{{ stat.progress }}%</strong>
          </div>
          <div class="course-bar-track">
            <div :style="{ width: `${stat.progress}%`, background: stat.course.color }"></div>
          </div>
          <p>
            剩 {{ stat.remainingUnits }} 块 ·
            <template v-if="stat.daysLeft > 0">{{ stat.daysLeft }} 天后考试</template>
            <template v-else-if="stat.daysLeft === 0">今天考试</template>
            <template v-else>考试日期已过</template>
          </p>
        </div>
      </div>

      <div class="workload-chart">
        <h3>未来 7 天预计用时</h3>
        <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" role="img" aria-label="未来七天复习分钟数折线图">
          <line :x1="left" :y1="top" :x2="left" :y2="top + innerHeight" class="axis" />
          <line :x1="left" :y1="top + innerHeight" :x2="chartWidth - 10" :y2="top + innerHeight" class="axis" />
          <text v-for="tick in [0, 0.5, 1]" :key="tick" :x="8" :y="top + innerHeight - innerHeight * tick + 4" class="tick-label">
            {{ Math.round(maxMinutes * tick) }}
          </text>
          <path :d="linePath" class="load-line" />
          <g v-for="point in points" :key="point.day.date">
            <circle :cx="point.x" :cy="point.y" r="5" :class="{ absent: Boolean(point.day.absence) }" />
            <text :x="point.x" :y="chartHeight - 16" text-anchor="middle" class="tick-label">{{ weekdayCN(point.day.date).replace('周', '') }}</text>
            <text :x="point.x" :y="chartHeight - 2" text-anchor="middle" class="date-label">{{ formatCN(point.day.date) }}</text>
          </g>
        </svg>
        <p class="chart-note">每个复习块 {{ MINUTES_PER_UNIT }} 分钟；灰点表示当日缺席且不安排任务。</p>
      </div>
    </template>
  </section>
</template>
