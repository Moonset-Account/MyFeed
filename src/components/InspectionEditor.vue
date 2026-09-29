<script setup lang="ts">
import type { InspectionData, ItemRecord, RoomDef, RoomInspection } from '../types'
import { uid } from '../store'

const props = defineProps<{
  title: string
  inspection: InspectionData
  rooms: RoomDef[]
}>()

function setNumber(
  target: RoomInspection,
  key: 'keys' | 'waterReading' | 'electricityReading',
  event: Event,
) {
  const raw = (event.target as HTMLInputElement).value
  target[key] = raw === '' ? null : Number(raw)
}

function addCaptionPhoto(record: ItemRecord) {
  record.photos.push({ id: uid(), caption: '' })
}

function onPhotoFile(record: ItemRecord, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    record.photos.push({ id: uid(), caption: file.name, dataUrl: String(reader.result) })
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function removePhoto(record: ItemRecord, photoId: string) {
  record.photos = record.photos.filter((p) => p.id !== photoId)
}

void props
</script>

<template>
  <section class="inspection-editor">
    <div class="editor-head">
      <h2>{{ title }}</h2>
      <label class="date-field">
        检查日期
        <input type="date" v-model="inspection.date" />
      </label>
    </div>

    <div v-for="room in rooms" :key="room.id" class="room-card">
      <h3>{{ room.name }}</h3>
      <div class="meter-row">
        <label>
          钥匙数量（把）
          <input
            type="number"
            min="0"
            :value="inspection.rooms[room.id]?.keys"
            @input="setNumber(inspection.rooms[room.id], 'keys', $event)"
            placeholder="未填"
          />
        </label>
        <label>
          水表读数
          <input
            type="number"
            step="0.01"
            :value="inspection.rooms[room.id]?.waterReading"
            @input="setNumber(inspection.rooms[room.id], 'waterReading', $event)"
            placeholder="未填"
          />
        </label>
        <label>
          电表读数
          <input
            type="number"
            step="0.01"
            :value="inspection.rooms[room.id]?.electricityReading"
            @input="setNumber(inspection.rooms[room.id], 'electricityReading', $event)"
            placeholder="未填"
          />
        </label>
      </div>

      <table class="item-table">
        <thead>
          <tr>
            <th class="col-name">设施</th>
            <th class="col-status">状态</th>
            <th class="col-note">备注</th>
            <th class="col-photo">照片说明</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in room.items" :key="item.id">
            <td>{{ item.name }}</td>
            <td>
              <select v-model="inspection.rooms[room.id].items[item.id].status">
                <option value="">未填写</option>
                <option value="good">完好</option>
                <option value="worn">磨损</option>
                <option value="damaged">损坏</option>
                <option value="missing">缺失</option>
              </select>
            </td>
            <td>
              <input
                type="text"
                v-model="inspection.rooms[room.id].items[item.id].note"
                placeholder="如：左上角有划痕"
              />
            </td>
            <td>
              <div
                v-for="photo in inspection.rooms[room.id].items[item.id].photos"
                :key="photo.id"
                class="photo-row"
              >
                <img v-if="photo.dataUrl" :src="photo.dataUrl" class="photo-thumb" alt="设施照片" />
                <input type="text" v-model="photo.caption" placeholder="照片说明" />
                <button
                  type="button"
                  class="btn-link"
                  @click="removePhoto(inspection.rooms[room.id].items[item.id], photo.id)"
                >
                  删除
                </button>
              </div>
              <div class="photo-actions">
                <button
                  type="button"
                  class="btn-link"
                  @click="addCaptionPhoto(inspection.rooms[room.id].items[item.id])"
                >
                  + 文字说明
                </button>
                <label class="btn-link file-label">
                  + 上传照片
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden-file"
                    @change="onPhotoFile(inspection.rooms[room.id].items[item.id], $event)"
                  />
                </label>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
