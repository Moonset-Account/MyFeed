<script setup lang="ts">
import { computed, ref } from 'vue'
import { state } from '../lib/store'
import {
  suggestForType,
  callParty,
  seatParty,
  passParty,
  cancelParty,
  shareSeat,
  freeTable,
  availableCount,
  type Party
} from '../lib/core'

const message = ref('')
const sharePick = ref<string[]>([])
const shareTypeId = ref('')

const calledList = computed(() =>
  state.parties.filter((p) => p.status === 'called')
)

const shareCandidates = computed(() =>
  calledList.value.filter((p) => sharePick.value.includes(p.id))
)
const shareTotal = computed(() =>
  shareCandidates.value.reduce((s, p) => s + p.size, 0)
)

function suggestion(typeId: string): Party | null {
  return suggestForType(state, typeId)
}

function act(fn: () => void) {
  message.value = ''
  try {
    fn()
  } catch (e) {
    message.value = (e as Error).message
  }
}

function callSuggested(typeId: string) {
  act(() => {
    const p = suggestForType(state, typeId)
    if (!p) {
      message.value = '当前没有适合该桌型的候位客人'
      return
    }
    callParty(state, p.id, typeId, Date.now())
  })
}

function onFree(typeId: string) {
  act(() => {
    if (!freeTable(state, typeId, Date.now())) {
      message.value = '该桌型当前没有已入座的桌'
    }
  })
}

function toggleShare(id: string) {
  const i = sharePick.value.indexOf(id)
  if (i >= 0) sharePick.value.splice(i, 1)
  else sharePick.value.push(id)
}

function doShare() {
  act(() => {
    if (!shareTypeId.value) {
      message.value = '请选择拼桌使用的桌型'
      return
    }
    shareSeat(state, sharePick.value, shareTypeId.value, Date.now())
    sharePick.value = []
  })
}
</script>

<template>
  <section class="panel">
    <h2>叫号台</h2>
    <p v-if="message" class="error">{{ message }}</p>

    <h3>桌型空位</h3>
    <table class="grid">
      <thead>
        <tr><th>桌型</th><th>座位</th><th>空位/总数</th><th>建议叫号</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in state.tableTypes" :key="t.id">
          <td>{{ t.name }}</td>
          <td>{{ t.seats }} 座</td>
          <td>{{ availableCount(state, t.id) }} / {{ t.total }}</td>
          <td>
            <template v-if="suggestion(t.id)">
              {{ suggestion(t.id)!.ticket }}（{{ suggestion(t.id)!.size }} 人）
            </template>
            <span v-else class="muted">无</span>
          </td>
          <td class="actions">
            <button class="primary" :disabled="!suggestion(t.id)" @click="callSuggested(t.id)">叫号</button>
            <button @click="onFree(t.id)">空出一桌</button>
          </td>
        </tr>
      </tbody>
    </table>

    <h3>已叫号（{{ calledList.length }}）</h3>
    <p v-if="calledList.length === 0" class="muted">暂无已叫号客人</p>
    <table v-else class="grid">
      <thead>
        <tr><th>拼桌</th><th>号码</th><th>人数</th><th>桌型</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="p in calledList" :key="p.id">
          <td>
            <input
              type="checkbox"
              :checked="sharePick.includes(p.id)"
              @change="toggleShare(p.id)"
            />
          </td>
          <td class="ticket-cell">{{ p.ticket }}</td>
          <td>{{ p.size }} 人</td>
          <td>{{ state.tableTypes.find((t) => t.id === p.tableTypeId)?.name ?? '-' }}</td>
          <td class="actions">
            <button class="primary" @click="act(() => seatParty(state, p.id, Date.now()))">入座</button>
            <button @click="act(() => passParty(state, p.id, Date.now()))">过号</button>
            <button class="danger" @click="act(() => cancelParty(state, p.id, Date.now()))">取消</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="sharePick.length >= 2" class="share-bar">
      <span>拼桌：{{ shareCandidates.map((p) => p.ticket).join(' + ') }}，共 {{ shareTotal }} 人</span>
      <select v-model="shareTypeId">
        <option value="" disabled>选择桌型</option>
        <option v-for="t in state.tableTypes" :key="t.id" :value="t.id">
          {{ t.name }}（{{ t.seats }} 座，空 {{ availableCount(state, t.id) }}）
        </option>
      </select>
      <button class="primary" @click="doShare">拼桌入座</button>
    </div>
  </section>
</template>
