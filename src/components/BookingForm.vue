<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { joinWaitlist, state, submitBooking } from '../store'
import { REJECT_TEXT, toISODate, type RejectReason } from '../lib/schedule'

const form = reactive({
  roomId: state.rooms[0]?.id ?? '',
  club: '',
  title: '',
  attendees: 10,
  date: toISODate(new Date()),
  start: '18:00',
  end: '20:00',
})

const message = ref('')
const reasons = ref<RejectReason[]>([])
const lastRejected = ref(false)

const room = computed(() => state.rooms.find((r) => r.id === form.roomId))

function toMinutes(text: string): number {
  const [h, m] = text.split(':').map(Number)
  return h * 60 + m
}

function payload() {
  return {
    roomId: form.roomId,
    club: form.club.trim(),
    title: form.title.trim(),
    attendees: form.attendees,
    date: form.date,
    start: toMinutes(form.start),
    end: toMinutes(form.end),
  }
}

function submit() {
  message.value = ''
  reasons.value = []
  lastRejected.value = false
  if (!form.club.trim() || !form.title.trim()) {
    message.value = '请填写社团名称和活动主题。'
    return
  }
  const result = submitBooking(payload())
  if (result.ok) {
    message.value = `预约成功：${room.value?.name} ${form.date} ${form.start}-${form.end}`
  } else {
    reasons.value = result.reasons
    lastRejected.value = true
  }
}

function waitlist() {
  joinWaitlist(payload())
  lastRejected.value = false
  reasons.value = []
  message.value = '已加入候补队列，时段空出后会自动提醒，可在「预约与候补」中查看。'
}
</script>

<template>
  <section class="panel">
    <h2>提交预约申请</h2>
    <form class="form-grid" @submit.prevent="submit">
      <label>
        房间
        <select v-model="form.roomId">
          <option v-for="r in state.rooms" :key="r.id" :value="r.id">
            {{ r.name }}（容量 {{ r.capacity }} 人）
          </option>
        </select>
      </label>
      <label>
        社团名称
        <input v-model="form.club" placeholder="如：摄影协会" />
      </label>
      <label>
        活动主题
        <input v-model="form.title" placeholder="如：招新宣讲" />
      </label>
      <label>
        活动人数
        <input v-model.number="form.attendees" type="number" min="1" />
      </label>
      <label>
        日期
        <input v-model="form.date" type="date" />
      </label>
      <label>
        开始时间
        <input v-model="form.start" type="time" />
      </label>
      <label>
        结束时间
        <input v-model="form.end" type="time" />
      </label>
      <div class="form-actions">
        <button type="submit" class="primary">提交预约</button>
        <button v-if="lastRejected" type="button" @click="waitlist">加入候补</button>
      </div>
    </form>

    <p v-if="message" class="notice ok">{{ message }}</p>
    <div v-if="reasons.length" class="notice error">
      <p>暂时无法预约：</p>
      <ul>
        <li v-for="r in reasons" :key="r">{{ REJECT_TEXT[r] }}</li>
      </ul>
      <p>可以调整时间，或点击「加入候补」排队等待。</p>
    </div>

    <div v-if="room" class="room-info">
      <h3>{{ room.name }}</h3>
      <p>容量 {{ room.capacity }} 人 · 设备：{{ room.equipment.join('、') || '无' }}</p>
    </div>
  </section>
</template>
