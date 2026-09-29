<script setup lang="ts">
import { computed, ref } from 'vue'
import { state } from '../store'
import { formatMinutes, mondayOfWeek, toISODate, WEEKDAYS } from '../lib/schedule'

const DAY_START = 7 * 60
const DAY_END = 22 * 60
const SPAN = DAY_END - DAY_START

const weekOffset = ref(0)
const roomId = ref(state.rooms[0]?.id ?? '')

const room = computed(() => state.rooms.find((r) => r.id === roomId.value))

const days = computed(() => {
  const monday = mondayOfWeek(new Date())
  monday.setDate(monday.getDate() + weekOffset.value * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return { iso: toISODate(d), weekday: i, label: `${d.getMonth() + 1}/${d.getDate()}` }
  })
})

const todayIso = toISODate(new Date())

function pct(min: number): number {
  return ((min - DAY_START) / SPAN) * 100
}

const bookingsByDay = computed(() => {
  const map = new Map<string, typeof state.bookings>()
  for (const day of days.value) map.set(day.iso, [])
  for (const b of state.bookings) {
    if (b.roomId === roomId.value && b.status === 'confirmed' && map.has(b.date)) {
      map.get(b.date)!.push(b)
    }
  }
  return map
})

function maintenanceFor(weekday: number) {
  return room.value?.maintenance.filter((m) => m.weekday === weekday) ?? []
}
</script>

<template>
  <section>
    <div class="toolbar">
      <label>
        房间
        <select v-model="roomId">
          <option v-for="r in state.rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <div class="week-nav">
        <button @click="weekOffset--">上一周</button>
        <button @click="weekOffset = 0">本周</button>
        <button @click="weekOffset++">下一周</button>
      </div>
    </div>

    <div v-if="room" class="week-grid">
      <div class="time-col">
        <div class="corner"></div>
        <div class="time-axis">
          <span v-for="h in [7, 10, 13, 16, 19, 22]" :key="h" :style="{ top: pct(h * 60) + '%' }">
            {{ h }}:00
          </span>
        </div>
      </div>
      <div v-for="day in days" :key="day.iso" class="day-col" :class="{ today: day.iso === todayIso }">
        <div class="day-head">{{ WEEKDAYS[day.weekday] }} {{ day.label }}</div>
        <div class="day-body">
          <div
            v-if="!room.openHours[day.weekday]"
            class="block closed"
          >闭馆</div>
          <div
            v-for="(m, i) in maintenanceFor(day.weekday)"
            :key="'m' + i"
            class="block maintenance"
            :style="{ top: pct(m.start) + '%', height: pct(m.end) - pct(m.start) + '%' }"
            :title="m.note"
          >
            维护 {{ formatMinutes(m.start) }}-{{ formatMinutes(m.end) }}
          </div>
          <div
            v-for="b in bookingsByDay.get(day.iso)"
            :key="b.id"
            class="block booking"
            :style="{ top: pct(b.start) + '%', height: pct(b.end) - pct(b.start) + '%' }"
          >
            <strong>{{ b.title }}</strong>
            <span>{{ b.club }} · {{ b.attendees }}人</span>
            <span>{{ formatMinutes(b.start) }}-{{ formatMinutes(b.end) }}</span>
          </div>
        </div>
      </div>
    </div>
    <p v-else>暂无房间，请先在「管理配置」中添加。</p>

    <div class="legend">
      <span><i class="swatch booking"></i>已确认预约</span>
      <span><i class="swatch maintenance"></i>维护时段</span>
      <span><i class="swatch closed"></i>闭馆</span>
    </div>
  </section>
</template>
