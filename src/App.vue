<script setup lang="ts">
import { computed, ref } from 'vue'
import { activeTrip, removeTrip, reuseTrip, setActiveTrip, state } from './store'
import { formatGrams, overweightMembers, validateSharedItems } from './logic'
import TripForm from './components/TripForm.vue'
import MemberPanel from './components/MemberPanel.vue'
import ItemTable from './components/ItemTable.vue'
import PrintList from './components/PrintList.vue'

const showTripForm = ref(false)
const showReuse = ref(false)
const reuseDestination = ref('')
const reuseDays = ref(3)

const trip = activeTrip

const overweight = computed(() => (trip.value ? overweightMembers(trip.value) : []))
const sharedErrors = computed(() => (trip.value ? validateSharedItems(trip.value) : []))

function openReuse() {
  if (!trip.value) return
  reuseDestination.value = trip.value.destination
  reuseDays.value = trip.value.days
  showReuse.value = true
}

function confirmReuse() {
  if (!trip.value) return
  reuseTrip(trip.value.id, reuseDestination.value, reuseDays.value)
  showReuse.value = false
}

function confirmRemoveTrip() {
  if (!trip.value) return
  if (window.confirm(`确定删除行程「${trip.value.name}」吗？该操作不可恢复。`)) {
    removeTrip(trip.value.id)
  }
}

function print() {
  window.print()
}
</script>

<template>
  <div class="app">
    <header class="app-header no-print">
      <h1>🧳 多人旅行打包清单</h1>
      <div v-if="state.trips.length > 0" class="trip-switcher">
        <select :value="state.activeTripId" @change="setActiveTrip(($event.target as HTMLSelectElement).value)">
          <option v-for="t in state.trips" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button class="btn-secondary" @click="showTripForm = true">新建行程</button>
        <template v-if="trip">
          <button class="btn-secondary" @click="openReuse">复用此清单</button>
          <button class="btn-secondary" @click="print">打印</button>
          <button class="btn-danger" @click="confirmRemoveTrip">删除行程</button>
        </template>
      </div>
    </header>

    <main class="screen">
      <TripForm v-if="showTripForm || state.trips.length === 0" @done="showTripForm = false" />

      <template v-else-if="trip">
        <div v-if="overweight.length > 0" class="banner warn">
          ⚠ 行李箱超重提醒：
          <span v-for="s in overweight" :key="s.member.id" class="banner-item">
            {{ s.member.name }} 超重 {{ formatGrams(s.overGrams) }}
          </span>
        </div>
        <div v-if="sharedErrors.length > 0" class="banner info">
          <p v-for="(e, i) in sharedErrors" :key="i">👥 {{ e }}（共享物品需指定一名负责人）</p>
        </div>

        <div v-if="showReuse" class="card reuse-panel">
          <h2>复用历史清单</h2>
          <p class="muted">将以「{{ trip.name }}」为模板创建新行程，物品打包状态会重置。</p>
          <div class="form-row">
            <label>
              目的地
              <input v-model="reuseDestination" type="text" />
            </label>
            <label>
              行程天数
              <input v-model.number="reuseDays" type="number" min="1" max="60" />
            </label>
          </div>
          <div class="actions">
            <button class="btn-primary" @click="confirmReuse">创建副本</button>
            <button class="btn-secondary" @click="showReuse = false">取消</button>
          </div>
        </div>

        <div class="layout">
          <MemberPanel :trip="trip" />
          <ItemTable :trip="trip" />
        </div>
      </template>
    </main>

    <PrintList v-if="trip" :trip="trip" class="print-only" />
  </div>
</template>
