<script setup lang="ts">
import { computed } from 'vue'
import type { AppState } from '../restaurant/types'
import { getSeatedParties, getTableViews } from '../restaurant/selectors'
import { formatQueueNumber } from '../restaurant/logic'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ state: AppState }>()
const emit = defineEmits<{ leave: [partyId: string] }>()
const tables = computed(() => getTableViews(props.state))
const seated = computed(() => getSeatedParties(props.state))
const grouped = computed(() => {
  const groups = new Map<string, typeof tables.value>()
  tables.value.forEach((view) => {
    const list = groups.get(view.table.typeId) ?? []
    list.push(view)
    groups.set(view.table.typeId, list)
  })
  return [...groups.entries()].map(([typeId, list]) => ({
    type: props.state.tableTypes.find((item) => item.id === typeId),
    list,
  }))
})
</script>

<template>
  <section class="card table-card">
    <div class="section-title">
      <div>
        <p class="eyebrow">桌台实时状态</p>
        <h2>空桌与拼桌</h2>
      </div>
    </div>
    <div v-for="group in grouped" :key="group.type?.id" class="table-group">
      <h3>{{ group.type?.name }} <small>{{ group.type?.seats }}座</small></h3>
      <div class="table-grid">
        <article v-for="view in group.list" :key="view.table.id" class="table-chip" :data-status="view.table.status">
          <div class="table-chip-head">
            <strong>{{ view.table.label }}</strong>
            <StatusBadge :status="view.table.status" />
          </div>
          <p>{{ view.usedSeats }}/{{ view.table.seats }} 座 · 余 {{ view.spareSeats }}</p>
          <div v-if="view.activeParties.length" class="mini-parties">
            <span v-for="party in view.activeParties" :key="party.id">
              {{ formatQueueNumber(party.number) }}{{ party.status === 'called' ? '（叫号中）' : '' }}
            </span>
          </div>
        </article>
      </div>
    </div>
    <div class="seated-panel">
      <h3>用餐中</h3>
      <div v-for="party in seated" :key="party.id" class="seated-row">
        <span>{{ formatQueueNumber(party.number) }} {{ party.name }} · {{ party.size }}人 · {{ party.tableIds.map((id) => state.tables.find((table) => table.id === id)?.label ?? id).join('、') }}</span>
        <button type="button" class="ghost" @click="emit('leave', party.id)">离店</button>
      </div>
      <p v-if="seated.length === 0" class="empty-note">暂无已入座客人。</p>
    </div>
  </section>
</template>
