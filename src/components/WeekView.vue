<script setup lang="ts">
import { computed, ref } from 'vue'
import { nowISO, store } from '../store'
import { flash } from '../ui'
import { cancelBooking } from '../lib/booking'
import { addDays, datePart, startOfWeek, timePart, toDateStr, WEEKDAY_NAMES } from '../lib/datetime'
import type { Booking, MaintenanceWindow } from '../lib/types'

const weekStart = ref(startOfWeek(new Date()))
const days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart.value, i)))
const selected = ref<Booking | null>(null)
const todayStr = toDateStr(new Date())

const weekLabel = computed(() => {
  const first = days.value[0]
  const last = days.value[6]
  return `${first.getMonth() + 1}月${first.getDate()}日 – ${last.getMonth() + 1}月${last.getDate()}日`
})

function roomBookings(roomId: string, day: Date): Booking[] {
  const ds = toDateStr(day)
  return store.bookings
    .filter((b) => b.roomId === roomId && b.status !== 'cancelled' && datePart(b.start) === ds)
    .sort((a, b) => a.start.localeCompare(b.start))
}

function roomMaintenance(roomId: string, day: Date): MaintenanceWindow[] {
  const ds = toDateStr(day)
  return store.maintenance.filter((m) => m.roomId === roomId && datePart(m.start) === ds)
}

function prevWeek(): void {
  weekStart.value = addDays(weekStart.value, -7)
}
function nextWeek(): void {
  weekStart.value = addDays(weekStart.value, 7)
}
function thisWeek(): void {
  weekStart.value = startOfWeek(new Date())
}

function roomName(id: string): string {
  return store.rooms.find((r) => r.id === id)?.name ?? '未知房间'
}

function onCancel(b: Booking): void {
  const notified = cancelBooking(store, b.id, nowISO())
  flash(
    notified
      ? `已取消「${b.title}」，并提醒候补社团「${notified.clubName}」前来确认`
      : `已取消「${b.title}」`,
  )
  selected.value = null
}
</script>

<template>
  <section>
    <div class="toolbar">
      <button @click="prevWeek">‹ 上一周</button>
      <button @click="thisWeek">本周</button>
      <button @click="nextWeek">下一周 ›</button>
      <span class="week-label">{{ weekLabel }}</span>
      <span class="legend">
        <i class="dot confirmed"></i>已确认
        <i class="dot waitlisted"></i>候补中
        <i class="dot maintenance"></i>维护
      </span>
    </div>

    <div class="week-grid">
      <div class="corner">房间</div>
      <div
        v-for="d in days"
        :key="toDateStr(d)"
        class="day-head"
        :class="{ today: toDateStr(d) === todayStr }"
      >
        {{ WEEKDAY_NAMES[d.getDay()] }}<br />{{ d.getMonth() + 1 }}/{{ d.getDate() }}
      </div>
      <template v-for="room in store.rooms" :key="room.id">
        <div class="room-head">
          <strong>{{ room.name }}</strong>
          <span>容量 {{ room.capacity }} 人</span>
        </div>
        <div
          v-for="d in days"
          :key="room.id + toDateStr(d)"
          class="day-cell"
          :class="{ today: toDateStr(d) === todayStr }"
        >
          <div
            v-for="m in roomMaintenance(room.id, d)"
            :key="m.id"
            class="chip maintenance"
            :title="m.reason"
          >
            🔧 {{ timePart(m.start) }}–{{ timePart(m.end) }} {{ m.reason }}
          </div>
          <button
            v-for="b in roomBookings(room.id, d)"
            :key="b.id"
            class="chip"
            :class="[b.status, { picked: selected?.id === b.id }]"
            @click="selected = b"
          >
            {{ timePart(b.start) }}–{{ timePart(b.end) }} {{ b.clubName }}
            <em v-if="b.status === 'waitlisted'">（候补）</em>
          </button>
        </div>
      </template>
    </div>

    <div v-if="selected" class="detail-card">
      <h3>{{ selected.title }}</h3>
      <p>
        {{ roomName(selected.roomId) }} · {{ datePart(selected.start) }}
        {{ timePart(selected.start) }}–{{ timePart(selected.end) }} · {{ selected.attendees }} 人
      </p>
      <p>
        社团：{{ selected.clubName }} · 状态：{{ selected.status === 'confirmed' ? '已确认' : '候补中' }}
        <template v-if="selected.notifiedAt">（已提醒可转正）</template>
      </p>
      <div class="row">
        <button class="danger" @click="onCancel(selected)">取消该预约</button>
        <button @click="selected = null">关闭</button>
      </div>
    </div>
  </section>
</template>
