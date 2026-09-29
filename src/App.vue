<script setup lang="ts">
import { ref } from 'vue'
import { project, exportToFile, importFromFile } from './store'
import { genId } from './logic/inspection'
import InspectionForm from './components/InspectionForm.vue'
import CompareView from './components/CompareView.vue'

type Tab = 'checkin' | 'checkout' | 'compare'
const tab = ref<Tab>('checkin')

const newRoomName = ref('')
const newFacilityNames = ref<Record<string, string>>({})

function addRoom() {
  const name = newRoomName.value.trim()
  if (!name) return
  project.rooms.push({ id: genId('room'), name, facilities: [] })
  newRoomName.value = ''
}

function removeRoom(roomId: string) {
  if (!confirm('删除该房间会同时删除两次检查中对应记录，确定删除？')) return
  project.rooms = project.rooms.filter((r) => r.id !== roomId)
  delete project.checkin.rooms[roomId]
  delete project.checkout.rooms[roomId]
}

function addFacility(roomId: string) {
  const name = (newFacilityNames.value[roomId] ?? '').trim()
  if (!name) return
  const room = project.rooms.find((r) => r.id === roomId)
  room?.facilities.push({ id: genId('fac'), name })
  newFacilityNames.value[roomId] = ''
}

function removeFacility(roomId: string, facilityId: string) {
  const room = project.rooms.find((r) => r.id === roomId)
  if (!room) return
  room.facilities = room.facilities.filter((f) => f.id !== facilityId)
  const ci = project.checkin.rooms[roomId]
  const co = project.checkout.rooms[roomId]
  if (ci) delete ci.facilityRecords[facilityId]
  if (co) delete co.facilityRecords[facilityId]
}

const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref('')

function triggerImport() {
  importError.value = ''
  fileInput.value?.click()
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await importFromFile(file)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败'
  }
}
</script>

<template>
  <div class="app">
    <header class="app-header no-print">
      <h1>出租房交接检查表</h1>
      <div class="header-actions">
        <button @click="exportToFile">导出 JSON 备份</button>
        <button @click="triggerImport">导入 JSON 备份</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="onImportFile"
        />
      </div>
    </header>
    <p v-if="importError" class="error no-print">导入失败：{{ importError }}</p>

    <div class="address-bar no-print">
      <label>
        房屋地址
        <input v-model.trim="project.address" type="text" placeholder="小区 / 楼栋 / 房号" />
      </label>
    </div>

    <details class="room-manager no-print">
      <summary>房间与设施管理（{{ project.rooms.length }} 个房间）</summary>
      <div class="room-manager-body">
        <div v-for="room in project.rooms" :key="room.id" class="room-manage-row">
          <strong>{{ room.name }}</strong>
          <span class="facility-chips">
            <span v-for="f in room.facilities" :key="f.id" class="chip">
              {{ f.name }}
              <button class="chip-remove" title="移除设施" @click="removeFacility(room.id, f.id)">×</button>
            </span>
          </span>
          <input
            v-model="newFacilityNames[room.id]"
            type="text"
            placeholder="新设施名称"
            @keyup.enter="addFacility(room.id)"
          />
          <button @click="addFacility(room.id)">添加设施</button>
          <button class="danger" @click="removeRoom(room.id)">删除房间</button>
        </div>
        <div class="room-manage-row">
          <input
            v-model="newRoomName"
            type="text"
            placeholder="新房间名称，如：次卧"
            @keyup.enter="addRoom"
          />
          <button @click="addRoom">添加房间</button>
        </div>
      </div>
    </details>

    <nav class="tabs no-print">
      <button :class="{ active: tab === 'checkin' }" @click="tab = 'checkin'">入住检查</button>
      <button :class="{ active: tab === 'checkout' }" @click="tab = 'checkout'">退租检查</button>
      <button :class="{ active: tab === 'compare' }" @click="tab = 'compare'">对比与交接单</button>
    </nav>

    <main>
      <InspectionForm
        v-if="tab === 'checkin'"
        :inspection="project.checkin"
        :rooms="project.rooms"
        title="入住检查"
      />
      <InspectionForm
        v-else-if="tab === 'checkout'"
        :inspection="project.checkout"
        :rooms="project.rooms"
        title="退租检查"
      />
      <CompareView v-else :project="project" />
    </main>
  </div>
</template>
