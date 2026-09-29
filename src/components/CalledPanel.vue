<script setup lang="ts">
import { computed } from 'vue'
import type { AppState } from '../restaurant/types'
import { getCalledParties } from '../restaurant/selectors'
import { formatClock } from '../restaurant/time'
import { formatQueueNumber } from '../restaurant/logic'

const props = defineProps<{ state: AppState }>()
const emit = defineEmits<{
  seat: [partyId: string]
  miss: [partyId: string]
  cancel: [partyId: string]
}>()
const called = computed(() => getCalledParties(props.state))
const tableLabel = (id: string): string =>
  props.state.tables.find((table) => table.id === id)?.label ?? id
</script>

<template>
  <section class="card">
    <div class="section-title">
      <div>
        <p class="eyebrow">待确认入座</p>
        <h2>已叫号</h2>
      </div>
      <span class="muted">{{ called.length }} 组</span>
    </div>
    <div class="called-list">
      <article v-for="party in called" :key="party.id" class="called-row">
        <div>
          <strong>{{ formatQueueNumber(party.number) }} {{ party.name }}</strong>
          <p>{{ party.size }}人 · {{ party.tableIds.map(tableLabel).join('、') }} · {{ party.calledAt ? formatClock(party.calledAt) : '' }} 叫号</p>
        </div>
        <div class="button-row">
          <button type="button" class="primary" @click="emit('seat', party.id)">入座</button>
          <button type="button" class="ghost" @click="emit('miss', party.id)">过号</button>
          <button type="button" class="ghost danger" @click="emit('cancel', party.id)">取消</button>
        </div>
      </article>
      <p v-if="called.length === 0" class="empty-note">没有等待确认的叫号。</p>
    </div>
  </section>
</template>
