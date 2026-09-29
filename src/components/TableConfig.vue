<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { TableType } from '../restaurant/types'
import { useWaitlistStore } from '../restaurant/store'

const store = useWaitlistStore()
const editingId = ref<string | null>(null)
const blank = () => ({ name: '', seats: 4, count: 1 })
const form = reactive(blank())

const resetForm = () => {
  Object.assign(form, blank())
  editingId.value = null
  store.dismissError()
}

const startEdit = (type: TableType) => {
  editingId.value = type.id
  form.name = type.name
  form.seats = type.seats
  form.count = type.count
  store.dismissError()
}

const submit = () => {
  const input = { ...form, name: form.name.trim(), seats: Number(form.seats), count: Number(form.count) }
  if (editingId.value) {
    store.updateTableType(editingId.value, input)
  } else {
    store.addTableType(input)
  }
  if (!store.error.value) resetForm()
}
</script>

<template>
  <section class="card config-card">
    <div class="section-title">
      <div>
        <p class="eyebrow">桌型与座位数</p>
        <h2>{{ editingId ? '编辑桌型' : '新增桌型' }}</h2>
      </div>
    </div>
    <form class="config-form" @submit.prevent="submit">
      <label>
        桌型名称
        <input v-model.trim="form.name" type="text" placeholder="如 10人包厢" maxlength="20" />
      </label>
      <label>
        每桌座位
        <input v-model.number="form.seats" type="number" min="1" max="30" />
      </label>
      <label>
        桌数
        <input v-model.number="form.count" type="number" min="0" max="99" />
      </label>
      <div class="button-row">
        <button class="primary" type="submit">{{ editingId ? '保存修改' : '添加桌型' }}</button>
        <button v-if="editingId" type="button" class="ghost" @click="resetForm">取消编辑</button>
      </div>
    </form>
    <p v-if="store.error.value" class="inline-error">{{ store.error.value }}</p>

    <div class="type-list">
      <article v-for="type in store.state.value.tableTypes" :key="type.id" class="type-row">
        <div>
          <strong>{{ type.name }}</strong>
          <p>{{ type.seats }} 座 × {{ type.count }} 桌 = {{ type.seats * type.count }} 座</p>
        </div>
        <div class="button-row">
          <button type="button" class="ghost" @click="startEdit(type)">编辑</button>
          <button type="button" class="ghost danger" @click="store.deleteTableType(type.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
