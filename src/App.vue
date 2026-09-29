<script setup lang="ts">
import { ref } from 'vue'
import RegisterForm from './components/RegisterForm.vue'
import RecordList from './components/RecordList.vue'
import HistorySearch from './components/HistorySearch.vue'
import StatsView from './components/StatsView.vue'
import ExportView from './components/ExportView.vue'

type Tab = 'register' | 'list' | 'history' | 'stats' | 'export'

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'register', label: '破损登记' },
  { key: 'list', label: '登记册' },
  { key: 'history', label: '书号查历史' },
  { key: 'stats', label: '待办统计' },
  { key: 'export', label: '导出清单' },
]

const active = ref<Tab>('register')
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>图书修补登记册</h1>
      <p class="subtitle">破损登记 · 修补流转 · 检查上架</p>
    </header>
    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: active === t.key }"
        @click="active = t.key"
      >
        {{ t.label }}
      </button>
    </nav>
    <main class="panel">
      <RegisterForm v-if="active === 'register'" @registered="active = 'list'" />
      <RecordList v-else-if="active === 'list'" />
      <HistorySearch v-else-if="active === 'history'" />
      <StatsView v-else-if="active === 'stats'" />
      <ExportView v-else />
    </main>
  </div>
</template>
