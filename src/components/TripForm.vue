<script setup lang="ts">
import { reactive, ref } from 'vue'
import { createMember, createTrip, suggestItems } from '../logic'
import { addTrip, setActiveTrip } from '../store'

const emit = defineEmits<{ done: [] }>()

const destination = ref('')
const days = ref(3)
const withSuggestions = ref(true)
const memberRows = reactive([{ name: '', limit: 15 }])
const error = ref('')

function addMemberRow() {
  memberRows.push({ name: '', limit: 15 })
}

function removeMemberRow(idx: number) {
  memberRows.splice(idx, 1)
}

function submit() {
  error.value = ''
  const dest = destination.value.trim()
  if (!dest) {
    error.value = '请填写目的地'
    return
  }
  if (!Number.isFinite(days.value) || days.value < 1) {
    error.value = '行程天数至少为 1 天'
    return
  }
  const trip = createTrip(dest, Math.round(days.value))
  for (const row of memberRows) {
    const name = row.name.trim()
    if (!name) continue
    trip.members.push(createMember(name, Math.max(0, row.limit)))
  }
  if (trip.members.length === 0) {
    error.value = '请至少添加一位同行成员'
    return
  }
  if (withSuggestions.value) {
    trip.items.push(...suggestItems(dest, days.value))
  }
  addTrip(trip)
  setActiveTrip(trip.id)
  emit('done')
}
</script>

<template>
  <form class="card trip-form" @submit.prevent="submit">
    <h2>新建行程</h2>
    <div class="form-row">
      <label>
        目的地
        <input v-model="destination" type="text" placeholder="例如：三亚" required />
      </label>
      <label>
        行程天数
        <input v-model.number="days" type="number" min="1" max="60" required />
      </label>
    </div>

    <fieldset>
      <legend>同行成员与行李箱限重</legend>
      <div v-for="(row, idx) in memberRows" :key="idx" class="form-row member-row">
        <input v-model="row.name" type="text" placeholder="成员姓名" />
        <label class="inline">
          限重
          <input v-model.number="row.limit" type="number" min="0" step="0.5" class="limit-input" />
          kg
        </label>
        <button
          v-if="memberRows.length > 1"
          type="button"
          class="btn-link"
          @click="removeMemberRow(idx)"
        >
          移除
        </button>
      </div>
      <button type="button" class="btn-secondary" @click="addMemberRow">+ 添加成员</button>
    </fieldset>

    <label class="inline">
      <input v-model="withSuggestions" type="checkbox" />
      按目的地与天数生成建议物品
    </label>

    <p v-if="error" class="error">{{ error }}</p>
    <div class="actions">
      <button type="submit" class="btn-primary">创建行程</button>
      <button type="button" class="btn-secondary" @click="emit('done')">取消</button>
    </div>
  </form>
</template>
