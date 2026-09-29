<script setup lang="ts">
import { ref } from 'vue'
import { state } from '../lib/store'
import { nextId, type TableType } from '../lib/core'

const name = ref('')
const seats = ref(4)
const total = ref(1)
const error = ref('')

function addType() {
  error.value = ''
  const n = name.value.trim()
  if (!n) {
    error.value = '请填写桌型名称'
    return
  }
  if (!Number.isInteger(seats.value) || seats.value < 1) {
    error.value = '座位数必须为正整数'
    return
  }
  if (!Number.isInteger(total.value) || total.value < 0) {
    error.value = '桌数不能为负'
    return
  }
  const t: TableType = { id: nextId('type'), name: n, seats: seats.value, total: total.value }
  state.tableTypes.push(t)
  state.tableTypes.sort((a, b) => a.seats - b.seats)
  state.logs.unshift({
    id: nextId('log'),
    at: Date.now(),
    type: 'config',
    message: `新增桌型 ${n}（${seats.value} 座 × ${total.value}）`
  })
  name.value = ''
  seats.value = 4
  total.value = 1
}

function removeType(id: string) {
  const inUse = state.parties.some(
    (p) => p.tableTypeId === id && (p.status === 'called' || p.status === 'seated')
  )
  if (inUse) {
    error.value = '该桌型有正在叫号或入座的客人，不能删除'
    return
  }
  error.value = ''
  const i = state.tableTypes.findIndex((t) => t.id === id)
  if (i >= 0) {
    const [removed] = state.tableTypes.splice(i, 1)
    state.logs.unshift({
      id: nextId('log'),
      at: Date.now(),
      type: 'config',
      message: `删除桌型 ${removed.name}`
    })
  }
}
</script>

<template>
  <section class="panel narrow">
    <h2>桌型配置</h2>
    <table class="grid">
      <thead>
        <tr><th>名称</th><th>座位数</th><th>桌数</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="t in state.tableTypes" :key="t.id">
          <td>{{ t.name }}</td>
          <td><input v-model.number="t.seats" type="number" min="1" class="num" /></td>
          <td><input v-model.number="t.total" type="number" min="0" class="num" /></td>
          <td><button class="danger" @click="removeType(t.id)">删除</button></td>
        </tr>
      </tbody>
    </table>

    <h3>新增桌型</h3>
    <form class="form inline" @submit.prevent="addType">
      <input v-model="name" placeholder="名称，如：包间" />
      <input v-model.number="seats" type="number" min="1" class="num" title="座位数" />
      <input v-model.number="total" type="number" min="0" class="num" title="桌数" />
      <button type="submit" class="primary">添加</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p class="hint">桌型按座位数升序决定取号前缀（A、B、C……）。修改座位数/桌数即时生效并保存在本机。</p>
  </section>
</template>
