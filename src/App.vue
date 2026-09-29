<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from './store'
import { ui } from './ui'
import WeekView from './components/WeekView.vue'
import BookingForm from './components/BookingForm.vue'
import BookingList from './components/BookingList.vue'
import AdminPanel from './components/AdminPanel.vue'

type Tab = 'week' | 'book' | 'manage' | 'admin'
const tab = ref<Tab>('week')
const tabs: { key: Tab; label: string }[] = [
  { key: 'week', label: '周视图' },
  { key: 'book', label: '提交预约' },
  { key: 'manage', label: '预约与候补' },
  { key: 'admin', label: '管理员配置' },
]

const reminderCount = computed(
  () => store.bookings.filter((b) => b.status === 'waitlisted' && b.notifiedAt !== null).length,
)
</script>

<template>
  <header class="topbar">
    <h1>校园活动室预约台</h1>
    <nav>
      <button
        v-for="t in tabs"
        :key="t.key"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span v-if="t.key === 'manage' && reminderCount" class="badge">{{ reminderCount }}</span>
      </button>
    </nav>
  </header>
  <div v-if="ui.flash" class="flash">{{ ui.flash }}</div>
  <main>
    <WeekView v-if="tab === 'week'" />
    <BookingForm v-else-if="tab === 'book'" />
    <BookingList v-else-if="tab === 'manage'" />
    <AdminPanel v-else />
  </main>
</template>
