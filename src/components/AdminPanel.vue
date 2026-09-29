<script setup lang="ts">
import { reactive } from 'vue'
import { resetDemo, store } from '../store'
import { flash } from '../ui'
import { combineDateTime, toDateStr, WEEKDAY_NAMES } from '../lib/datetime'
import type { Room } from '../lib/types'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const maintenanceForm = reactive({
  roomId: store.rooms[0]?.id ?? '',
  date: toDateStr(new Date()),
  start: '09:00',
  end: '12:00',
  reason: '',
})

function equipmentText(room: Room): string {
  return room.equipment.join('，')
}
function setEquipment(room: Room, text: string): void {
  room.equipment = text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function addRange(room: Room, day: number): void {
  const ranges = room.openHours[day] ?? (room.openHours[day] = [])
  ranges.push({ start: '09:00', end: '12:00' })
}
function removeRange(room: Room, day: number, index: number): void {
  room.openHours[day]?.splice(index, 1)
}

function addRoom(): void {
  const room: Room = {
    id: crypto.randomUUID(),
    name: '新活动室',
    capacity: 20,
    equipment: [],
    openHours: Object.fromEntries(DAY_ORDER.map((d) => [d, d >= 1 && d <= 5 ? [{ start: '08:00', end: '21:00' }] : []])),
  }
  store.rooms.push(room)
  flash(`已添加房间「${room.name}」，请完善配置`)
}

function removeRoom(room: Room): void {
  const related = store.bookings.filter((b) => b.roomId === room.id && b.status !== 'cancelled').length
  const tip = related ? `，其 ${related} 条进行中的预约将一并取消` : ''
  if (!window.confirm(`确定删除「${room.name}」吗${tip}？`)) return
  store.bookings.forEach((b) => {
    if (b.roomId === room.id) b.status = 'cancelled'
  })
  store.maintenance = store.maintenance.filter((m) => m.roomId !== room.id)
  store.rooms = store.rooms.filter((r) => r.id !== room.id)
  flash(`已删除房间「${room.name}」`)
}

function addMaintenance(): void {
  if (!maintenanceForm.roomId || !maintenanceForm.reason.trim()) {
    flash('请选择房间并填写维护原因')
    return
  }
  const start = combineDateTime(maintenanceForm.date, maintenanceForm.start)
  const end = combineDateTime(maintenanceForm.date, maintenanceForm.end)
  if (Date.parse(start) >= Date.parse(end)) {
    flash('维护时段无效：开始需早于结束')
    return
  }
  store.maintenance.push({
    id: crypto.randomUUID(),
    roomId: maintenanceForm.roomId,
    start,
    end,
    reason: maintenanceForm.reason.trim(),
  })
  maintenanceForm.reason = ''
  flash('维护时段已保存')
}

function removeMaintenance(id: string): void {
  store.maintenance = store.maintenance.filter((m) => m.id !== id)
}

function roomName(id: string): string {
  return store.rooms.find((r) => r.id === id)?.name ?? '未知房间'
}

function onReset(): void {
  if (!window.confirm('将清空当前全部配置与预约并恢复演示数据，确定吗？')) return
  resetDemo()
  flash('已重置为演示数据')
}
</script>

<template>
  <section class="panel">
    <div class="row spread">
      <h2>管理员配置</h2>
      <button class="danger" @click="onReset">重置演示数据</button>
    </div>

    <h3>房间与开放时段</h3>
    <div v-for="room in store.rooms" :key="room.id" class="room-card">
      <div class="form-grid">
        <label>
          房间名称
          <input v-model="room.name" type="text" />
        </label>
        <label>
          容量（人）
          <input v-model.number="room.capacity" type="number" min="1" />
        </label>
        <label class="span2">
          设备（用逗号分隔）
          <input :value="equipmentText(room)" type="text" @input="setEquipment(room, ($event.target as HTMLInputElement).value)" />
        </label>
      </div>
      <table class="hours-table">
        <thead>
          <tr><th>星期</th><th>开放时段</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="day in DAY_ORDER" :key="day">
            <td>{{ WEEKDAY_NAMES[day] }}</td>
            <td>
              <span v-for="(range, i) in room.openHours[day] ?? []" :key="i" class="range">
                <input v-model="range.start" type="time" />
                –
                <input v-model="range.end" type="time" />
                <button class="small danger" @click="removeRange(room, day, i)">删</button>
              </span>
              <em v-if="!(room.openHours[day] ?? []).length" class="hint">不开放</em>
            </td>
            <td><button class="small" @click="addRange(room, day)">添加时段</button></td>
          </tr>
        </tbody>
      </table>
      <div class="row">
        <button class="danger small" @click="removeRoom(room)">删除房间</button>
      </div>
    </div>
    <button @click="addRoom">＋ 添加房间</button>

    <h3>维护时段</h3>
    <div class="form-grid">
      <label>
        房间
        <select v-model="maintenanceForm.roomId">
          <option v-for="r in store.rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <label>
        日期
        <input v-model="maintenanceForm.date" type="date" />
      </label>
      <label>
        开始
        <input v-model="maintenanceForm.start" type="time" />
      </label>
      <label>
        结束
        <input v-model="maintenanceForm.end" type="time" />
      </label>
      <label class="span2">
        原因
        <input v-model="maintenanceForm.reason" type="text" placeholder="如：空调检修" />
      </label>
    </div>
    <button class="primary" @click="addMaintenance">添加维护时段</button>

    <ul class="maintenance-list">
      <li v-for="m in store.maintenance" :key="m.id">
        🔧 {{ roomName(m.roomId) }} · {{ m.start.slice(0, 10) }} {{ m.start.slice(11, 16) }}–{{ m.end.slice(11, 16) }} · {{ m.reason }}
        <button class="small danger" @click="removeMaintenance(m.id)">删除</button>
      </li>
    </ul>
  </section>
</template>
