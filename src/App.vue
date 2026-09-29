<script setup lang="ts">
import { ref } from 'vue'
import WeekView from './components/WeekView.vue'
import BookingForm from './components/BookingForm.vue'
import BookingList from './components/BookingList.vue'
import AdminPanel from './components/AdminPanel.vue'

const tabs = [
  { key: 'week', label: '周视图' },
  { key: 'book', label: '预约申请' },
  { key: 'list', label: '预约与候补' },
  { key: 'admin', label: '管理配置' },
] as const

const active = ref<(typeof tabs)[number]['key']>('week')
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>校园活动室预约台</h1>
      <nav>
        <button
          v-for="t in tabs"
          :key="t.key"
          :class="{ active: active === t.key }"
          @click="active = t.key"
        >
          {{ t.label }}
        </button>
      </nav>
    </header>
    <main>
      <WeekView v-if="active === 'week'" />
      <BookingForm v-else-if="active === 'book'" />
      <BookingList v-else-if="active === 'list'" />
      <AdminPanel v-else />
    </main>
  </div>
</template>
