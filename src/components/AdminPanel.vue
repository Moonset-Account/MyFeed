<script setup lang="ts">
import { reactive, ref } from 'vue'
import { newRoom, resetAll, saveRoom, state } from '../store'
import type { Room } from '../types'
import { formatMinutes, parseMinutes, WEEKDAYS } from '../lib/schedule'

interface OpenDay {
  open: boolean
  start: string
  end: string
}

interface Draft {
  id: string
  name: string
  capacity: number
  equipment: string
  days: OpenDay[]
}

const editingId = ref<string | null>(null)
const draft = reactive<Draft>({ id: '', name: '', capacity: 20, equipment: '', days: [] })
const error = ref('')
const savedTip = ref('')

const newMaintenance = reactive({ weekday: 0, start: '12:00', end: '13:00', note: '' })
const maintenanceDraft = ref<Room['maintenance']>([])

function toDraft(room: Room) {
  editingId.value = room.id
  draft.id = room.id
  draft.name = room.name
  draft.capacity = room.capacity
  draft.equipment = room.equipment.join('、')
  draft.days = room.openHours.map((r) => ({
    open: r !== null,
    start: formatMinutes(r?.start ?? 480),
    end: formatMinutes(r?.end ?? 1260),
  }))
  maintenanceDraft.value = room.maintenance.map((m) => ({ ...m }))
  error.value = ''
  savedTip.value = ''
}

function startCreate() {
  toDraft(newRoom())
}

function addMaintenance() {
  const start = parseMinutes(newMaintenance.start)
  const end = parseMinutes(newMaintenance.end)
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
    error.value = '维护时段的开始/结束时间不正确。'
    return
  }
  maintenanceDraft.value.push({
    weekday: newMaintenance.weekday,
    start,
    end,
    note: newMaintenance.note.trim() || undefined,
  })
  error.value = ''
}

function removeMaintenance(index: number) {
  maintenanceDraft.value.splice(index, 1)
}

function save() {
  error.value = ''
  savedTip.value = ''
  if (!draft.name.trim()) {
    error.value = '请填写房间名称。'
    return
  }
  if (!(draft.capacity > 0)) {
    error.value = '容量必须大于 0。'
    return
  }
  const openHours: Room['openHours'] = []
  for (let i = 0; i < 7; i++) {
    const d = draft.days[i]
    if (!d.open) {
      openHours.push(null)
      continue
    }
    const start = parseMinutes(d.start)
    const end = parseMinutes(d.end)
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) {
      error.value = `${WEEKDAYS[i]}的开放时间不正确。`
      return
    }
    openHours.push({ start, end })
  }
  saveRoom({
    id: draft.id,
    name: draft.name.trim(),
    capacity: draft.capacity,
    equipment: draft.equipment.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
    openHours,
    maintenance: maintenanceDraft.value.map((m) => ({ ...m })),
  })
  savedTip.value = '已保存。'
  editingId.value = null
}

function cancelEdit() {
  editingId.value = null
  error.value = ''
}

function confirmReset() {
  if (window.confirm('确定要清空全部本地数据并恢复演示数据吗？')) {
    resetAll()
    editingId.value = null
  }
}
</script>

<template>
  <section>
    <div class="panel">
      <div class="panel-head">
        <h2>房间配置</h2>
        <div>
          <button class="primary" @click="startCreate">新增房间</button>
          <button class="danger" @click="confirmReset">重置演示数据</button>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>房间</th><th>容量</th><th>设备</th><th>维护时段</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="r in state.rooms" :key="r.id">
            <td>{{ r.name }}</td>
            <td>{{ r.capacity }} 人</td>
            <td>{{ r.equipment.join('、') || '—' }}</td>
            <td>
              <span v-if="!r.maintenance.length">—</span>
              <span v-for="(m, i) in r.maintenance" :key="i" class="badge">
                {{ WEEKDAYS[m.weekday] }} {{ formatMinutes(m.start) }}-{{ formatMinutes(m.end) }}
              </span>
            </td>
            <td><button @click="toDraft(r)">编辑</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="editingId" class="panel">
      <h2>编辑房间</h2>
      <div class="form-grid">
        <label>
          房间名称
          <input v-model="draft.name" />
        </label>
        <label>
          容量（人）
          <input v-model.number="draft.capacity" type="number" min="1" />
        </label>
        <label>
          设备（用顿号或逗号分隔）
          <input v-model="draft.equipment" placeholder="投影仪、音响" />
        </label>
      </div>

      <h3>开放时段</h3>
      <div class="open-days">
        <div v-for="(d, i) in draft.days" :key="i" class="open-day">
          <label><input v-model="d.open" type="checkbox" /> {{ WEEKDAYS[i] }}</label>
          <template v-if="d.open">
            <input v-model="d.start" type="time" /> 至 <input v-model="d.end" type="time" />
          </template>
          <span v-else class="empty">闭馆</span>
        </div>
      </div>

      <h3>维护时段</h3>
      <ul class="maintenance-list">
        <li v-for="(m, i) in maintenanceDraft" :key="i">
          {{ WEEKDAYS[m.weekday] }} {{ formatMinutes(m.start) }}-{{ formatMinutes(m.end) }}
          <span v-if="m.note">（{{ m.note }}）</span>
          <button class="danger" @click="removeMaintenance(i)">删除</button>
        </li>
      </ul>
      <div class="maintenance-add">
        <select v-model.number="newMaintenance.weekday">
          <option v-for="(w, i) in WEEKDAYS" :key="i" :value="i">{{ w }}</option>
        </select>
        <input v-model="newMaintenance.start" type="time" /> 至
        <input v-model="newMaintenance.end" type="time" />
        <input v-model="newMaintenance.note" placeholder="备注（可选）" />
        <button @click="addMaintenance">添加维护时段</button>
      </div>

      <p v-if="error" class="notice error">{{ error }}</p>
      <div class="form-actions">
        <button class="primary" @click="save">保存</button>
        <button @click="cancelEdit">取消</button>
        <span v-if="savedTip" class="notice ok">{{ savedTip }}</span>
      </div>
    </div>
  </section>
</template>
