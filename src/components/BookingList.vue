<script setup lang="ts">
import { computed } from 'vue'
import {
  cancelBooking,
  cancelWaitlistEntry,
  confirmWaitlistEntry,
  roomById,
  state,
} from '../store'
import { formatMinutes } from '../lib/schedule'

const confirmed = computed(() =>
  state.bookings
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start),
)

const activeWaitlist = computed(() =>
  state.waitlist
    .filter((w) => w.status === 'waiting' || w.status === 'notified')
    .sort((a, b) => a.createdAt - b.createdAt),
)

const notifiedCount = computed(
  () => state.waitlist.filter((w) => w.status === 'notified').length,
)
</script>

<template>
  <section>
    <div v-if="notifiedCount" class="notice warn">
      有 {{ notifiedCount }} 条候补申请已等到空位，请尽快确认。
    </div>

    <div class="panel">
      <h2>已确认预约</h2>
      <table v-if="confirmed.length">
        <thead>
          <tr>
            <th>日期</th><th>时间</th><th>房间</th><th>社团 / 活动</th><th>人数</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in confirmed" :key="b.id">
            <td>{{ b.date }}</td>
            <td>{{ formatMinutes(b.start) }}-{{ formatMinutes(b.end) }}</td>
            <td>{{ roomById(b.roomId)?.name ?? b.roomId }}</td>
            <td>{{ b.club }} · {{ b.title }}</td>
            <td>{{ b.attendees }}</td>
            <td><button class="danger" @click="cancelBooking(b.id)">取消</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">暂无已确认的预约。</p>
    </div>

    <div class="panel">
      <h2>候补队列</h2>
      <table v-if="activeWaitlist.length">
        <thead>
          <tr>
            <th>日期</th><th>时间</th><th>房间</th><th>社团 / 活动</th><th>人数</th><th>状态</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in activeWaitlist" :key="w.id" :class="{ notified: w.status === 'notified' }">
            <td>{{ w.date }}</td>
            <td>{{ formatMinutes(w.start) }}-{{ formatMinutes(w.end) }}</td>
            <td>{{ roomById(w.roomId)?.name ?? w.roomId }}</td>
            <td>{{ w.club }} · {{ w.title }}</td>
            <td>{{ w.attendees }}</td>
            <td>
              <span v-if="w.status === 'notified'" class="badge notified">已提醒，可确认</span>
              <span v-else class="badge">排队中</span>
            </td>
            <td>
              <button
                v-if="w.status === 'notified'"
                class="primary"
                @click="confirmWaitlistEntry(w.id)"
              >确认预约</button>
              <button class="danger" @click="cancelWaitlistEntry(w.id)">取消</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">暂无候补申请。</p>
    </div>
  </section>
</template>
