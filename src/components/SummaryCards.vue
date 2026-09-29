<script setup lang="ts">
import type { AppState } from '../restaurant/types'
import { getDaySummary } from '../restaurant/selectors'

defineProps<{ state: AppState }>()
</script>

<template>
  <div class="summary-grid">
    <div class="summary-card">
      <strong>{{ getDaySummary(state).waitingGroups }}</strong>
      <span>等待桌数</span>
    </div>
    <div class="summary-card accent">
      <strong>{{ getDaySummary(state).waitingPeople }}</strong>
      <span>预计等待人数</span>
    </div>
    <div class="summary-card">
      <strong>{{ getDaySummary(state).calledGroups }}</strong>
      <span>已叫号</span>
    </div>
    <div class="summary-card">
      <strong>{{ getDaySummary(state).seatedGroups }}</strong>
      <span>用餐中</span>
    </div>
    <div class="summary-card">
      <strong>{{ getDaySummary(state).freeTables }}</strong>
      <span>空桌</span>
    </div>
    <div class="summary-card">
      <strong>{{ getDaySummary(state).servedPeople }}</strong>
      <span>累计服务人数</span>
    </div>
  </div>
</template>
