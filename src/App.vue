<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useWaitlistStore } from './restaurant/store'
import { formatDateCN } from './restaurant/time'
import WaitingScreen from './components/WaitingScreen.vue'
import SummaryCards from './components/SummaryCards.vue'
import RegisterForm from './components/RegisterForm.vue'
import SuggestionPanel from './components/SuggestionPanel.vue'
import WaitingList from './components/WaitingList.vue'
import CalledPanel from './components/CalledPanel.vue'
import TableBoard from './components/TableBoard.vue'
import TableConfig from './components/TableConfig.vue'
import LogPanel from './components/LogPanel.vue'

const store = useWaitlistStore()
const tab = ref<'work' | 'config' | 'logs'>('work')

let dayTimer: number | undefined
onMounted(() => {
  store.ensureToday()
  dayTimer = window.setInterval(store.ensureToday, 30000)
})
onUnmounted(() => window.clearInterval(dayTimer))

const clearToday = () => {
  const confirmed = window.confirm('确定清空当天候位、叫号、入座和餐桌占用数据吗？桌型配置会保留。')
  if (confirmed) store.clearDay()
}

const confirmAction = (message: string, action: () => void) => {
  if (window.confirm(message)) action()
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">Restaurant Waitlist</p>
        <h1>餐厅候位叫号台</h1>
        <p class="header-date">{{ formatDateCN(store.state.value.day.dateKey) }} · 数据仅保存在本机浏览器</p>
      </div>
      <div class="header-actions">
        <nav class="tabs" aria-label="功能切换">
          <button :class="{ active: tab === 'work' }" type="button" @click="tab = 'work'">营业台</button>
          <button :class="{ active: tab === 'config' }" type="button" @click="tab = 'config'">桌型配置</button>
          <button :class="{ active: tab === 'logs' }" type="button" @click="tab = 'logs'">记录</button>
        </nav>
        <button type="button" class="ghost danger" @click="clearToday">当天数据清空</button>
      </div>
    </header>

    <main>
      <section v-if="tab === 'work'" class="workspace">
        <WaitingScreen :state="store.state.value" />
        <SummaryCards :state="store.state.value" />
        <div class="dashboard-grid">
          <div class="left-column">
            <RegisterForm />
            <SuggestionPanel
              :suggestions="store.suggestions.value"
              @call="(partyId, tableId, kind) => store.call(partyId, tableId, kind)"
            />
          </div>
          <div class="right-column">
            <WaitingList
              :state="store.state.value"
              :suggestions="store.suggestions.value"
              @cancel="(partyId) => confirmAction('确定取消这位客人的候位登记吗？此操作会保留记录。', () => store.cancel(partyId))"
            />
            <CalledPanel
              :state="store.state.value"
              @seat="(partyId) => store.seat(partyId)"
              @miss="(partyId) => confirmAction('确定标记为过号吗？此操作会保留记录并释放预留桌。', () => store.miss(partyId))"
              @cancel="(partyId) => confirmAction('确定取消这位已叫号客人吗？此操作会保留记录并释放预留桌。', () => store.cancel(partyId))"
            />
            <TableBoard
              :state="store.state.value"
              @leave="(partyId) => confirmAction('确定办理离店并释放餐桌吗？拼桌记录会保留。', () => store.leave(partyId))"
            />
          </div>
        </div>
      </section>

      <section v-else-if="tab === 'config'" class="simple-layout">
        <TableConfig />
      </section>

      <section v-else class="simple-layout">
        <LogPanel :state="store.state.value" />
      </section>
    </main>

    <div v-if="store.error.value" class="toast" role="alert">
      <span>{{ store.error.value }}</span>
      <button type="button" @click="store.dismissError()">知道了</button>
    </div>
  </div>
</template>
