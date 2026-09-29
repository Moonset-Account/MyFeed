<script setup lang="ts">
import { computed } from 'vue'
import type { Item, Trip } from '../types'
import { formatGrams, memberWeightGrams } from '../logic'

const props = defineProps<{ trip: Trip }>()

interface Group {
  title: string
  items: Item[]
  totalGrams: number | null
}

const groups = computed<Group[]>(() => {
  const result: Group[] = props.trip.members.map((m) => ({
    title: m.name,
    items: props.trip.items.filter((it) => it.assigneeId === m.id),
    totalGrams: memberWeightGrams(props.trip.items, m.id),
  }))
  const unassigned = props.trip.items.filter((it) => !it.assigneeId)
  if (unassigned.length > 0) {
    result.push({ title: '未分配', items: unassigned, totalGrams: null })
  }
  return result.filter((g) => g.items.length > 0)
})

const today = new Date().toLocaleDateString('zh-CN')
</script>

<template>
  <section class="print-list">
    <h1>{{ trip.name }} · 打包清单</h1>
    <p class="print-meta">
      目的地：{{ trip.destination }} ｜ 行程 {{ trip.days }} 天 ｜ 打印日期：{{ today }}
    </p>
    <div v-for="g in groups" :key="g.title" class="print-group">
      <h2>
        {{ g.title }}
        <span v-if="g.totalGrams !== null" class="print-weight">（共 {{ formatGrams(g.totalGrams) }}）</span>
      </h2>
      <ul>
        <li v-for="item in g.items" :key="item.id">
          <span class="checkbox">{{ item.packed ? '☑' : '☐' }}</span>
          {{ item.name }}
          <template v-if="item.quantity > 1">× {{ item.quantity }}</template>
          <span v-if="item.shared" class="print-shared">（共享）</span>
        </li>
      </ul>
    </div>
  </section>
</template>
