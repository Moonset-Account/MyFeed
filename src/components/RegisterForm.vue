<script setup lang="ts">
import { ref } from 'vue'
import { state } from '../lib/store'
import { registerParty, smallestFittingType, type Party } from '../lib/core'

const size = ref(2)
const allowShare = ref(false)
const error = ref('')
const issued = ref<Party | null>(null)

function submit() {
  error.value = ''
  try {
    issued.value = registerParty(state, size.value, allowShare.value, Date.now())
  } catch (e) {
    error.value = (e as Error).message
    issued.value = null
  }
}

function fittingLabel(): string {
  const t = smallestFittingType(state, size.value)
  return t ? `${t.name}（${t.seats} 座）` : '无合适桌型'
}
</script>

<template>
  <section class="panel narrow">
    <h2>登记取号</h2>
    <form @submit.prevent="submit" class="form">
      <label>
        就餐人数
        <input v-model.number="size" type="number" min="1" max="99" required />
      </label>
      <label class="checkbox">
        <input v-model="allowShare" type="checkbox" />
        接受拼桌
      </label>
      <p class="hint">预计安排桌型：{{ fittingLabel() }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" class="primary big">取号</button>
    </form>

    <div v-if="issued" class="ticket">
      <p class="ticket-label">请取号</p>
      <p class="ticket-no">{{ issued.ticket }}</p>
      <p>{{ issued.size }} 人 · 到店 {{ new Date(issued.arrivedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</p>
    </div>
  </section>
</template>
