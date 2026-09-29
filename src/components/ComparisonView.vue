<script setup lang="ts">
import { computed } from 'vue'
import { project } from '../store'
import { compareInspections, statusLabel } from '../logic'

const comparisons = computed(() => compareInspections(project))

function fmt(value: number | null): string {
  return value === null ? '—' : String(value)
}
</script>

<template>
  <section>
    <h2>入住 / 退租逐项对比</h2>
    <p class="hint">状态发生变化的设施会以橙色标出；用量 = 退租读数 − 入住读数。</p>
    <div v-for="room in comparisons" :key="room.roomId" class="room-card">
      <h3>{{ room.roomName }}</h3>
      <div class="compare-summary">
        <span>钥匙：{{ fmt(room.keysIn) }} → {{ fmt(room.keysOut) }} 把
          <em v-if="room.keysDiff !== null && room.keysDiff !== 0" class="changed">
            （{{ room.keysDiff > 0 ? '+' : '' }}{{ room.keysDiff }}）
          </em>
        </span>
        <span>水表：{{ fmt(room.waterIn) }} → {{ fmt(room.waterOut) }}，用量 {{ fmt(room.waterUsage) }}</span>
        <span>电表：{{ fmt(room.electricityIn) }} → {{ fmt(room.electricityOut) }}，用量 {{ fmt(room.electricityUsage) }}</span>
      </div>
      <table class="item-table">
        <thead>
          <tr>
            <th class="col-name">设施</th>
            <th class="col-status">入住状态</th>
            <th class="col-status">退租状态</th>
            <th class="col-status">变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in room.items" :key="item.itemId" :class="{ 'row-changed': item.changed }">
            <td>{{ item.itemName }}</td>
            <td>{{ statusLabel(item.checkInStatus) }}</td>
            <td>{{ statusLabel(item.checkOutStatus) }}</td>
            <td>
              <span v-if="item.changed" class="badge-changed">有变化</span>
              <span v-else class="badge-same">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
