<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActivityLog, AppState } from '../restaurant/types'
import { getLogsByType } from '../restaurant/selectors'
import { formatClock } from '../restaurant/time'
import { logTypeLabels } from '../restaurant/labels'

const props = defineProps<{ state: AppState }>()
const filters: Array<{ label: string; value?: ActivityLog['type'][] }> = [
  { label: '全部' },
  { label: '过号 / 取消', value: ['missed', 'cancelled'] },
  { label: '拼桌 / 入座', value: ['shared', 'seated'] },
  { label: '清空', value: ['cleared'] },
]
const active = ref(0)
const logs = computed(() => getLogsByType(props.state, filters[active.value]?.value))
</script>

<template>
  <section class="card log-card">
    <div class="section-title">
      <div>
        <p class="eyebrow">操作留痕</p>
        <h2>当天记录</h2>
      </div>
    </div>
    <div class="filter-row">
      <button
        v-for="(filter, index) in filters"
        :key="filter.label"
        type="button"
        class="filter"
        :class="{ active: active === index }"
        @click="active = index"
      >
        {{ filter.label }}
      </button>
    </div>
    <div class="log-list">
      <article v-for="log in logs" :key="log.id" class="log-row">
        <time>{{ formatClock(log.time) }}</time>
        <span class="log-type">{{ logTypeLabels[log.type] }}</span>
        <p>{{ log.detail }}</p>
      </article>
      <p v-if="logs.length === 0" class="empty-note">暂无记录。</p>
    </div>
  </section>
</template>
