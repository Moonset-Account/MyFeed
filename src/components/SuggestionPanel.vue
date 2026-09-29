<script setup lang="ts">
import type { CallSuggestion } from '../restaurant/types'
import { formatQueueNumber } from '../restaurant/logic'
import StatusBadge from './StatusBadge.vue'

defineProps<{ suggestions: CallSuggestion[] }>()
const emit = defineEmits<{
  call: [partyId: string, tableId: string, kind: 'direct' | 'shared']
}>()
</script>

<template>
  <section class="card">
    <div class="section-title">
      <div>
        <p class="eyebrow">空桌 / 拼桌建议</p>
        <h2>叫号建议</h2>
      </div>
      <span class="muted">{{ suggestions.length }} 组可安排</span>
    </div>
    <div v-if="suggestions.length" class="suggestion-list">
      <article v-for="item in suggestions" :key="item.party.id" class="suggestion" :data-kind="item.kind">
        <div>
          <div class="suggestion-head">
            <strong>{{ formatQueueNumber(item.party.number) }}</strong>
            <StatusBadge :status="item.kind === 'direct' ? 'free' : 'occupied'" />
          </div>
          <p>{{ item.party.name }} · {{ item.party.size }}人</p>
          <small>{{ item.reason }}</small>
        </div>
        <button class="primary" type="button" @click="emit('call', item.party.id, item.table.id, item.kind)">
          {{ item.kind === 'shared' ? '叫去拼桌' : '叫号入座' }}
        </button>
      </article>
    </div>
    <p v-else class="empty-note">暂无可直接安排的餐桌。登记“接受拼桌”后，系统会检查在餐桌的余位。</p>
  </section>
</template>
