<script setup lang="ts">
import { computed } from 'vue'
import { nowISO, store } from '../store'
import { flash } from '../ui'
import { cancelBooking, confirmWaitlisted, ISSUE_TEXT } from '../lib/booking'
import { datePart, timePart } from '../lib/datetime'
import type { Booking } from '../lib/types'

const active = computed(() =>
  store.bookings
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start) || a.createdAt.localeCompare(b.createdAt)),
)

const reminders = computed(() => active.value.filter((b) => b.status === 'waitlisted' && b.notifiedAt))

function roomName(id: string): string {
  return store.rooms.find((r) => r.id === id)?.name ?? '未知房间'
}

function onCancel(b: Booking): void {
  const notified = cancelBooking(store, b.id, nowISO())
  flash(
    notified
      ? `已取消「${b.title}」，时段空出，已提醒候补社团「${notified.clubName}」`
      : `已取消「${b.title}」`,
  )
}

function onConfirm(b: Booking): void {
  const issues = confirmWaitlisted(store, b.id)
  if (issues.length === 0) {
    flash(`候补转正成功：${b.title}`)
  } else {
    flash(`暂无法转正：${issues.map((i) => ISSUE_TEXT[i]).join('；')}`)
  }
}
</script>

<template>
  <section class="panel">
    <h2>预约与候补</h2>

    <div v-if="reminders.length" class="reminders">
      <h3>候补提醒</h3>
      <div v-for="b in reminders" :key="b.id" class="reminder-card">
        <p>
          「{{ b.clubName }}」候补的 {{ roomName(b.roomId) }} {{ datePart(b.start) }}
          {{ timePart(b.start) }}–{{ timePart(b.end) }} 已空出，请确认是否转正。
        </p>
        <div class="row">
          <button class="primary" @click="onConfirm(b)">确认转正</button>
          <button class="danger" @click="onCancel(b)">放弃候补</button>
        </div>
      </div>
    </div>

    <table v-if="active.length" class="data-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>房间</th>
          <th>活动</th>
          <th>社团</th>
          <th>人数</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in active" :key="b.id" :class="{ notified: b.status === 'waitlisted' && b.notifiedAt }">
          <td>{{ datePart(b.start) }} {{ timePart(b.start) }}–{{ timePart(b.end) }}</td>
          <td>{{ roomName(b.roomId) }}</td>
          <td>{{ b.title }}</td>
          <td>{{ b.clubName }}</td>
          <td>{{ b.attendees }}</td>
          <td>
            <span class="status" :class="b.status">
              {{ b.status === 'confirmed' ? '已确认' : b.notifiedAt ? '候补·已提醒' : '候补中' }}
            </span>
          </td>
          <td>
            <button v-if="b.status === 'waitlisted' && b.notifiedAt" class="primary small" @click="onConfirm(b)">
              确认转正
            </button>
            <button class="danger small" @click="onCancel(b)">取消</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="hint">暂无进行中的预约，可在「提交预约」中创建。</p>
  </section>
</template>
