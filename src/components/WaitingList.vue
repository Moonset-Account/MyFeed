<script setup lang="ts">
import { computed } from 'vue'
import type { AppState, CallSuggestion } from '../restaurant/types'
import { getAheadCounts, getWaitingParties } from '../restaurant/selectors'
import { formatClock } from '../restaurant/time'
import { formatQueueNumber } from '../restaurant/logic'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ state: AppState; suggestions: CallSuggestion[] }>()
const emit = defineEmits<{ cancel: [partyId: string] }>()
const waiting = computed(() => getWaitingParties(props.state))
const suggestedIds = computed(() => new Set(props.suggestions.map((item) => item.party.id)))
</script>

<template>
  <section class="card">
    <div class="section-title">
      <div>
        <p class="eyebrow">候位队列</p>
        <h2>当前候位</h2>
      </div>
      <span class="muted">按到店时间先后</span>
    </div>
    <div class="party-list">
      <article v-for="party in waiting" :key="party.id" class="party-row" :class="{ highlighted: suggestedIds.has(party.id) }">
        <div>
          <div class="party-head">
            <strong>{{ formatQueueNumber(party.number) }}</strong>
            <StatusBadge :status="party.status" />
            <span v-if="party.acceptShare" class="tag">接受拼桌</span>
          </div>
          <p>{{ party.name }} · {{ party.size }}人 · {{ formatClock(party.arrivalTime) }} 到店</p>
          <small>
            前方 {{ getAheadCounts(state, party.id).groups }} 组 /
            {{ getAheadCounts(state, party.id).people }} 人
          </small>
        </div>
        <button type="button" class="ghost danger" @click="emit('cancel', party.id)">取消</button>
      </article>
      <p v-if="waiting.length === 0" class="empty-note">候位队列为空。</p>
    </div>
  </section>
</template>
