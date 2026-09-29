<script setup lang="ts">
import {
  ensureFacilityRecord,
  ensureRoomRecord,
  STATUS_LABELS,
  type FacilityStatus,
  type Inspection,
  type RoomDef,
} from '../logic/inspection'

const props = defineProps<{
  inspection: Inspection
  rooms: RoomDef[]
  title: string
}>()

const statusOptions: { value: FacilityStatus; label: string }[] = [
  { value: 'good', label: STATUS_LABELS.good },
  { value: 'damaged', label: STATUS_LABELS.damaged },
  { value: 'missing', label: STATUS_LABELS.missing },
]

function roomRecord(roomId: string) {
  return ensureRoomRecord(props.inspection, roomId)
}

function facilityRecord(roomId: string, facilityId: string) {
  return ensureFacilityRecord(props.inspection, roomId, facilityId)
}

function toNumberOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function onNumberInput(roomId: string, field: 'keyCount' | 'waterMeter' | 'electricMeter', e: Event) {
  const rec = roomRecord(roomId)
  rec[field] = toNumberOrNull((e.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="inspection-form">
    <h2>{{ title }}</h2>

    <div class="meta-grid">
      <label>
        检查日期
        <input v-model="inspection.date" type="date" />
      </label>
      <label>
        出租方签字姓名
        <input v-model.trim="inspection.landlordName" type="text" placeholder="手写签字处打印姓名" />
      </label>
      <label>
        承租方签字姓名
        <input v-model.trim="inspection.tenantName" type="text" placeholder="手写签字处打印姓名" />
      </label>
    </div>

    <div v-for="room in rooms" :key="room.id" class="room-card">
      <h3>{{ room.name }}</h3>

      <table class="facility-table">
        <thead>
          <tr>
            <th>设施</th>
            <th>状态</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="facility in room.facilities" :key="facility.id">
            <td>{{ facility.name }}</td>
            <td>
              <select
                :value="facilityRecord(room.id, facility.id).status"
                :class="{ empty: facilityRecord(room.id, facility.id).status === '' }"
                @change="facilityRecord(room.id, facility.id).status = ($event.target as HTMLSelectElement).value as FacilityStatus | ''"
              >
                <option value="">未填写</option>
                <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </td>
            <td>
              <input
                v-model="facilityRecord(room.id, facility.id).note"
                type="text"
                placeholder="损坏位置、程度等"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="room-grid">
        <label>
          钥匙数量（把）
          <input
            type="number"
            min="0"
            :value="roomRecord(room.id).keyCount ?? ''"
            @input="onNumberInput(room.id, 'keyCount', $event)"
          />
        </label>
        <label>
          水表读数（吨）
          <input
            type="number"
            min="0"
            step="0.01"
            :value="roomRecord(room.id).waterMeter ?? ''"
            @input="onNumberInput(room.id, 'waterMeter', $event)"
          />
        </label>
        <label>
          电表读数（度）
          <input
            type="number"
            min="0"
            step="0.01"
            :value="roomRecord(room.id).electricMeter ?? ''"
            @input="onNumberInput(room.id, 'electricMeter', $event)"
          />
        </label>
      </div>

      <label class="photo-note">
        照片说明
        <textarea
          v-model="roomRecord(room.id).photoNote"
          rows="2"
          placeholder="例如：已拍摄客厅全景、空调遥控器、墙面划痕特写（照片编号 01-05）"
        ></textarea>
      </label>
    </div>
  </section>
</template>
