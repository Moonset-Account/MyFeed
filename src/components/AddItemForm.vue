<script setup lang="ts">
import { ref } from 'vue'
import type { Trip } from '../types'
import { createItem } from '../logic'

const props = defineProps<{ trip: Trip }>()

const name = ref('')
const category = ref('衣物')
const quantity = ref(1)
const weightGrams = ref(100)
const shared = ref(false)
const assigneeId = ref<string>('')

const categories = ['衣物', '洗漱', '电子', '证件', '药品', '食品', '其他']

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  props.trip.items.push(
    createItem({
      name: trimmed,
      category: category.value,
      quantity: Math.max(1, Math.round(quantity.value) || 1),
      weightGrams: Math.max(0, Math.round(weightGrams.value) || 0),
      shared: shared.value,
      assigneeId: assigneeId.value || null,
    }),
  )
  name.value = ''
  quantity.value = 1
  weightGrams.value = 100
  shared.value = false
  assigneeId.value = ''
}
</script>

<template>
  <form class="add-item" @submit.prevent="submit">
    <input v-model="name" type="text" placeholder="物品名称" required />
    <select v-model="category">
      <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
    </select>
    <label class="inline small">
      数量
      <input v-model.number="quantity" type="number" min="1" class="num-input" />
    </label>
    <label class="inline small">
      单件克重
      <input v-model.number="weightGrams" type="number" min="0" class="num-input" />
    </label>
    <select v-model="assigneeId">
      <option value="">未分配</option>
      <option v-for="m in trip.members" :key="m.id" :value="m.id">{{ m.name }}</option>
    </select>
    <label class="inline small">
      <input v-model="shared" type="checkbox" />
      共享
    </label>
    <button type="submit" class="btn-primary">添加物品</button>
  </form>
</template>
