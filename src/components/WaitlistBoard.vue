<script setup lang="ts">
import { computed } from 'vue'
import { state } from '../lib/store'
import {
  waitingList,
  waitingAhead,
  smallestFittingType,
  requeueParty,
  cancelParty
} from '../lib/core'

const waiting = computed(() => waitingList(state))
const called = computed(() => state.parties.filter((p) => p.status === 'called'))
const passed = computed(() => state.parties.filter((p) => p.status === 'passed'))

const totalWaitingPeople = computed(() =>
  waiting.value.reduce((s, p) => s + p.size, 0)
)

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function typeName(p: { size: number }): string {
  return smallestFittingType(state, p.size)?.name ?? '-'
}

function requeue(id: string) {
  requeueParty(state, id, Date.now())
}

function cancel(id: string) {
  cancelParty(state, id, Date.now())
}
</script>

<template>
  <section class="panel board">
    <div class="board-summary">
      <div class="stat">
        <span class="stat-num">{{ waiting.length }}</span>
        <span class="stat-label">候位组数</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ totalWaitingPeople }}</span>
        <span class="stat-label">预计等待人数</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ called.length }}</span>
        <span class="stat-label">已叫号</span>
      </div>
    </div>

    <div v-if="called.length" class="called-strip">
      <span class="called-label">正在叫号：</span>
      <span v-for="p in called" :key="p.id" class="called-ticket">{{ p.ticket }}</span>
    </div>

    <h3>当前候位</h3>
    <p v-if="waiting.length === 0" class="muted">暂无候位客人</p>
    <table v-else class="grid board-grid">
      <thead>
        <tr><th>号码</th><th>人数</th><th>桌型</th><th>到店时间</th><th>前方等待</th><th>拼桌</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in waiting" :key="p.id">
          <td class="ticket-cell">{{ p.ticket }}</td>
          <td>{{ p.size }} 人</td>
          <td>{{ typeName(p) }}</td>
          <td>{{ fmt(p.arrivedAt) }}</td>
          <td>{{ waitingAhead(state, p.id) }} 组</td>
          <td>{{ p.allowShare ? '接受' : '—' }}</td>
        </tr>
      </tbody>
    </table>

    <template v-if="passed.length">
      <h3>过号客人</h3>
      <table class="grid">
        <thead>
          <tr><th>号码</th><th>人数</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in passed" :key="p.id">
            <td class="ticket-cell">{{ p.ticket }}</td>
            <td>{{ p.size }} 人</td>
            <td class="actions">
              <button @click="requeue(p.id)">重新排队</button>
              <button class="danger" @click="cancel(p.id)">取消</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>
