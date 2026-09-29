<script setup lang="ts">
import { ref } from 'vue'
import { project, exportJson, importJson, resetProject } from './store'
import InspectionEditor from './components/InspectionEditor.vue'
import RoomManager from './components/RoomManager.vue'
import ComparisonView from './components/ComparisonView.vue'
import HandoverDoc from './components/HandoverDoc.vue'

type Tab = 'checkIn' | 'checkOut' | 'compare' | 'handover'
const tab = ref<Tab>('checkIn')
const tabs: { key: Tab; label: string }[] = [
  { key: 'checkIn', label: '入住检查' },
  { key: 'checkOut', label: '退租检查' },
  { key: 'compare', label: '逐项对比' },
  { key: 'handover', label: '交接单' },
]

const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function downloadBackup() {
  const blob = new Blob([exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `rental-inspection-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.value = '已导出 JSON 备份文件'
}

function triggerImport() {
  fileInput.value?.click()
}

function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const result = importJson(String(reader.result))
    message.value = result.ok ? '备份已导入' : `导入失败：${result.error}`
  }
  reader.readAsText(file)
  input.value = ''
}

function confirmReset() {
  if (window.confirm('确定清空全部数据并恢复默认模板吗？此操作不可撤销。')) {
    resetProject()
    message.value = '已重置为默认模板'
  }
}
</script>

<template>
  <div class="app">
    <header class="app-header no-print">
      <h1>出租房交接检查表</h1>
      <div class="header-tools">
        <label class="address-field">
          房屋地址
          <input type="text" v-model="project.propertyAddress" placeholder="如：XX小区 3 栋 502" />
        </label>
        <button type="button" class="btn" @click="downloadBackup">导出 JSON 备份</button>
        <button type="button" class="btn" @click="triggerImport">导入备份</button>
        <button type="button" class="btn danger" @click="confirmReset">重置</button>
        <input ref="fileInput" type="file" accept="application/json" class="hidden-file" @change="onImportFile" />
      </div>
      <p v-if="message" class="message">{{ message }}</p>
    </header>

    <nav class="tabs no-print">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        :class="['tab', { active: tab === t.key }]"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <main>
      <template v-if="tab === 'checkIn'">
        <RoomManager class="no-print" />
        <InspectionEditor title="入住检查" :inspection="project.checkIn" :rooms="project.rooms" />
      </template>
      <InspectionEditor
        v-else-if="tab === 'checkOut'"
        title="退租检查"
        :inspection="project.checkOut"
        :rooms="project.rooms"
      />
      <ComparisonView v-else-if="tab === 'compare'" />
      <HandoverDoc v-else />
    </main>
  </div>
</template>
