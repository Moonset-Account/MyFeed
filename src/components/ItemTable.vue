<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PersonFilter, Trip } from '../types'
import { filterItemsByPerson, formatGrams } from '../logic'
import AddItemForm from './AddItemForm.vue'

const props = defineProps<{ trip: Trip }>()

const personFilter = ref<PersonFilter>('all')
const hidePacked = ref(false)

const visibleItems = computed(() => {
  let list = filterItemsByPerson(props.trip.items, personFilter.value)
  if (hidePacked.value) list = list.filter((it) => !it.packed)
  return list
})

const packedCount = computed(() => props.trip.items.filter((it) => it.packed).length)

function memberName(id: string | null): string {
  if (!id) return '未分配'
  return props.trip.members.find((m) => m.id === id)?.name ?? '未分配'
}

function removeItem(id: string) {
  const idx = props.trip.items.findIndex((it) => it.id === id)
  if (idx >= 0) props.trip.items.splice(idx, 1)
}
</script>

<template>
  <section class="card item-section">
    <div class="item-header">
      <h2>打包物品（{{ packedCount }} / {{ trip.items.length }} 已打包）</h2>
      <div class="filters no-print">
        <select v-model="personFilter" aria-label="按人筛选">
          <option value="all">全部成员</option>
          <option value="unassigned">未分配</option>
          <option v-for="m in trip.members" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <label class="inline small">
          <input v-model="hidePacked" type="checkbox" />
          隐藏已打包
        </label>
      </div>
    </div>

    <AddItemForm :trip="trip" class="no-print" />

    <table class="item-table">
      <thead>
        <tr>
          <th>已打包</th>
          <th>物品</th>
          <th>分类</th>
          <th>数量</th>
          <th>单件重量</th>
          <th>携带人 / 负责人</th>
          <th class="no-print">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in visibleItems" :key="item.id" :class="{ packed: item.packed }">
          <td>
            <input v-model="item.packed" type="checkbox" :aria-label="`标记 ${item.name} 已打包`" />
          </td>
          <td>
            {{ item.name }}
            <span v-if="item.shared" class="badge" title="共享物品：全员共用，仅一名负责人">共享</span>
          </td>
          <td>{{ item.category }}</td>
          <td>{{ item.quantity }}</td>
          <td>{{ formatGrams(item.weightGrams) }}</td>
          <td>
            <select v-model="item.assigneeId" class="assignee-select no-print">
              <option :value="null">未分配</option>
              <option v-for="m in trip.members" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <span class="print-only">{{ memberName(item.assigneeId) }}</span>
          </td>
          <td class="no-print">
            <button class="btn-link" @click="removeItem(item.id)">删除</button>
          </td>
        </tr>
        <tr v-if="visibleItems.length === 0">
          <td colspan="7" class="empty">暂无物品，请在上方添加</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
