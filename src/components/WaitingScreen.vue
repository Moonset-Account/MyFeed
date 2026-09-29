<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AppState } from '../restaurant/types'
import { getCalledParties, getDaySummary, getWaitingParties } from '../restaurant/selectors'
import { formatClock, formatDateCN, minutesBetween, nowLocalDateTime } from '../restaurant/time'
import { formatQueueNumber } from '../restaurant/logic'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ state: AppState }>()
const waiting = computed(() => getWaitingParties(props.state))
const called = computed(() => getCalledParties(props.state))
const currentCall = computed(() => called.value[0] ?? null)
const nextParty = computed(() => waiting.value[0] ?? null)
const summary = computed(() => getDaySummary(props.state))
const currentTime = ref(nowLocalDateTime())
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = nowLocalDateTime()
  }, 30000)
})
onUnmounted(() => window.clearInterval(timer))
const current = computed(() => currentTime.value)
</script>

<template>
  <section class="waiting-screen">
    <div class="screen-topline">
      <span>{{ formatDateCN(state.day.dateKey) }}</span>
      <span>{{ formatClock(current) }} 实时更新</span>
    </div>
    <div class="screen-hero">
      <div>
        <p class="eyebrow">当前叫号</p>
        <div v-if="currentCall" class="hero-number">{{ formatQueueNumber(currentCall.number) }}</div>
        <div v-else class="hero-number empty">暂无叫号</div>
        <p class="next-call">
          下一位：
          <template v-if="nextParty">{{ formatQueueNumber(nextParty.number) }} {{ nextParty.name }} {{ nextParty.size }}人</template>
          <template v-else>无</template>
        </p>
      </div>
      <div class="hero-metrics">
        <div>
          <strong>{{ summary.waitingGroups }}</strong>
          <span>等待桌数</span>
        </div>
        <div>
          <strong>{{ summary.waitingPeople }}</strong>
          <span>预计等待人数</span>
        </div>
        <div>
          <strong>{{ summary.freeTables }}</strong>
          <span>当前空桌</span>
        </div>
      </div>
    </div>
    <div class="screen-list">
      <div v-for="(party, index) in waiting.slice(0, 6)" :key="party.id" class="screen-row" :class="{ next: index === 0 }">
        <span class="rank">{{ index + 1 }}</span>
        <strong>{{ formatQueueNumber(party.number) }}</strong>
        <span>{{ party.name }} · {{ party.size }}人</span>
        <span>{{ formatClock(party.arrivalTime) }} 到店</span>
        <span>已等 {{ minutesBetween(party.arrivalTime, current) }} 分钟</span>
        <StatusBadge :status="party.status" />
      </div>
      <p v-if="waiting.length === 0" class="empty-note">所有登记客人都已安排，可继续登记新的到店客人。</p>
    </div>
  </section>
</template>
