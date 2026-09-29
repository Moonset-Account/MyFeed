<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Trip } from '../types'
import { createMember, formatGrams, suitcaseStatuses } from '../logic'

const props = defineProps<{ trip: Trip }>()

const newName = ref('')
const newLimit = ref(15)

const statuses = computed(() => suitcaseStatuses(props.trip))

function addMember() {
  const name = newName.value.trim()
  if (!name) return
  props.trip.members.push(createMember(name, Math.max(0, newLimit.value)))
  newName.value = ''
  newLimit.value = 15
}

function removeMember(id: string) {
  const idx = props.trip.members.findIndex((m) => m.id === id)
  if (idx < 0) return
  props.trip.members.splice(idx, 1)
  // 该成员名下物品转为未分配，避免悬空引用
  for (const item of props.trip.items) {
    if (item.assigneeId === id) item.assigneeId = null
  }
}

function percent(total: number, limit: number): number {
  if (limit <= 0) return total > 0 ? 100 : 0
  return Math.min(100, Math.round((total / limit) * 100))
}
</script>

<template>
  <section class="card member-panel">
    <h2>成员与行李箱</h2>
    <ul class="member-list">
      <li v-for="s in statuses" :key="s.member.id" :class="{ overweight: s.overweight }">
        <div class="member-head">
          <strong>{{ s.member.name }}</strong>
          <span class="weight-text">
            {{ formatGrams(s.totalGrams) }} / {{ s.member.suitcaseLimitKg }} kg
          </span>
          <button class="btn-link" @click="removeMember(s.member.id)">移除</button>
        </div>
        <div class="progress">
          <div
            class="progress-bar"
            :class="{ over: s.overweight }"
            :style="{ width: percent(s.totalGrams, s.limitGrams) + '%' }"
          ></div>
        </div>
        <p v-if="s.overweight" class="warn-text">
          ⚠ 已超重 {{ formatGrams(s.overGrams) }}，请减少物品或调整分配
        </p>
        <label class="inline small">
          限重
          <input
            v-model.number="s.member.suitcaseLimitKg"
            type="number"
            min="0"
            step="0.5"
            class="limit-input"
          />
          kg
        </label>
      </li>
    </ul>
    <div class="form-row">
      <input v-model="newName" type="text" placeholder="新成员姓名" @keyup.enter="addMember" />
      <label class="inline">
        限重
        <input v-model.number="newLimit" type="number" min="0" step="0.5" class="limit-input" />
        kg
      </label>
      <button class="btn-secondary" @click="addMember">添加</button>
    </div>
  </section>
</template>
