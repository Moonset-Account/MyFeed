<script setup lang="ts">
import { ref } from 'vue'
import { state, resetDay } from './lib/store'
import RegisterForm from './components/RegisterForm.vue'
import CallBoard from './components/CallBoard.vue'
import WaitlistBoard from './components/WaitlistBoard.vue'
import TableConfig from './components/TableConfig.vue'
import LogList from './components/LogList.vue'

type Tab = 'board' | 'register' | 'call' | 'tables' | 'logs'
const tab = ref<Tab>('board')
const tabs: { key: Tab; label: string }[] = [
  { key: 'board', label: '候位屏' },
  { key: 'register', label: '登记取号' },
  { key: 'call', label: '叫号台' },
  { key: 'tables', label: '桌型配置' },
  { key: 'logs', label: '记录' }
]

function onClear() {
  if (window.confirm('确定清空当天全部候位数据吗？桌型配置会保留。')) {
    resetDay()
  }
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1>餐厅候位叫号台</h1>
      <div class="topbar-right">
        <span class="date">{{ state.date }}</span>
        <button class="danger" @click="onClear">清空当天数据</button>
      </div>
    </header>
    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>
    <main>
      <WaitlistBoard v-if="tab === 'board'" />
      <RegisterForm v-else-if="tab === 'register'" />
      <CallBoard v-else-if="tab === 'call'" />
      <TableConfig v-else-if="tab === 'tables'" />
      <LogList v-else />
    </main>
  </div>
</template>
