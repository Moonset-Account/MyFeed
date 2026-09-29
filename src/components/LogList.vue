<script setup lang="ts">
import { computed } from 'vue'
import { state } from '../lib/store'

const logs = computed(() => state.logs)

const typeLabels: Record<string, string> = {
  register: '取号',
  call: '叫号',
  seat: '入座/离店',
  pass: '过号',
  requeue: '重排',
  cancel: '取消',
  share: '拼桌',
  clear: '清空',
  config: '配置'
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<template>
  <section class="panel">
    <h2>当天记录（{{ logs.length }}）</h2>
    <p v-if="logs.length === 0" class="muted">暂无记录</p>
    <table v-else class="grid">
      <thead>
        <tr><th>时间</th><th>类型</th><th>内容</th></tr>
      </thead>
      <tbody>
        <tr v-for="l in logs" :key="l.id">
          <td>{{ fmt(l.at) }}</td>
          <td><span class="tag" :class="`tag-${l.type}`">{{ typeLabels[l.type] ?? l.type }}</span></td>
          <td>{{ l.message }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
