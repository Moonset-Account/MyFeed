<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { nowISO, store } from '../store'
import { flash } from '../ui'
import { canWaitlist, ISSUE_TEXT, submitBooking, type IssueCode } from '../lib/booking'
import { combineDateTime, toDateStr, WEEKDAY_NAMES } from '../lib/datetime'

const form = reactive({
  roomId: store.rooms[0]?.id ?? '',
  date: toDateStr(new Date()),
  start: '14:00',
  end: '15:00',
  attendees: 10,
  clubName: '',
  title: '',
})

const issues = ref<IssueCode[]>([])
const waitlistable = ref(false)
const formError = ref('')

const room = computed(() => store.rooms.find((r) => r.id === form.roomId))

const openHoursText = computed(() => {
  if (!room.value || !form.date) return ''
  const weekday = new Date(`${form.date}T00:00:00`).getDay()
  const ranges = room.value.openHours[weekday] ?? []
  const label = WEEKDAY_NAMES[weekday]
  return ranges.length
    ? `${label}开放：${ranges.map((r) => `${r.start}–${r.end}`).join('、')}`
    : `${label}不开放`
})

function submit(allowWaitlist: boolean): void {
  formError.value = ''
  if (!form.clubName.trim() || !form.title.trim()) {
    formError.value = '请填写社团名称和活动主题'
    return
  }
  if (!form.roomId) {
    formError.value = '请选择房间'
    return
  }
  const res = submitBooking(
    store,
    {
      roomId: form.roomId,
      start: combineDateTime(form.date, form.start),
      end: combineDateTime(form.date, form.end),
      attendees: Number(form.attendees),
      clubName: form.clubName.trim(),
      title: form.title.trim(),
      allowWaitlist,
    },
    nowISO(),
  )
  if (res.booking) {
    issues.value = []
    waitlistable.value = false
    flash(
      res.booking.status === 'confirmed'
        ? `预约成功：${res.booking.title}`
        : `该时段已被占用，已为「${res.booking.clubName}」登记候补`,
    )
    return
  }
  issues.value = res.issues
  waitlistable.value = canWaitlist(res.issues)
}
</script>

<template>
  <section class="panel narrow">
    <h2>提交预约</h2>
    <div class="form-grid">
      <label>
        房间
        <select v-model="form.roomId">
          <option v-for="r in store.rooms" :key="r.id" :value="r.id">
            {{ r.name }}（容量 {{ r.capacity }}）
          </option>
        </select>
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
      <label>
        参与人数
        <input v-model.number="form.attendees" type="number" min="1" />
      </label>
      <label>
        社团名称
        <input v-model="form.clubName" type="text" placeholder="如：摄影协会" />
      </label>
      <label class="span2">
        活动主题
        <input v-model="form.title" type="text" placeholder="如：秋季外拍作品分享会" />
      </label>
    </div>

    <div v-if="room" class="room-info">
      <p>设备：{{ room.equipment.length ? room.equipment.join('、') : '无' }}</p>
      <p>{{ openHoursText }}</p>
    </div>

    <p v-if="formError" class="error">{{ formError }}</p>
    <ul v-if="issues.length" class="issues">
      <li v-for="i in issues" :key="i">{{ ISSUE_TEXT[i] }}</li>
    </ul>

    <div class="row">
      <button class="primary" @click="submit(false)">检查并预约</button>
      <button v-if="waitlistable" class="warn" @click="submit(true)">时段已被占用，加入候补</button>
    </div>
    <p v-if="waitlistable" class="hint">该时段与已有预约撞期，可登记候补；对方取消后系统会按提交顺序提醒。</p>
  </section>
</template>
