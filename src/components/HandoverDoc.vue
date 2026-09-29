<script setup lang="ts">
import { computed } from 'vue'
import { project } from '../store'
import { canGenerateFinal, compareInspections, statusLabel } from '../logic'

const finalCheck = computed(() => canGenerateFinal(project))
const comparisons = computed(() => compareInspections(project))

function fmt(value: number | null): string {
  return value === null ? '—' : String(value)
}

function printDoc() {
  window.print()
}
</script>

<template>
  <section>
    <h2 class="no-print">交接单</h2>

    <div class="signature-panel no-print">
      <h3>签字姓名</h3>
      <label>
        房东签字
        <input type="text" v-model="project.signatures.landlord" placeholder="输入房东姓名" />
      </label>
      <label>
        租客签字
        <input type="text" v-model="project.signatures.tenant" placeholder="输入租客姓名" />
      </label>
    </div>

    <div v-if="!finalCheck.ok" class="blocker no-print">
      <h3>完成版交接单不可生成</h3>
      <p>以下项目尚未完成，请补齐后再生成交接单：</p>
      <ul>
        <li v-for="(m, i) in finalCheck.missing" :key="i">{{ m }}</li>
      </ul>
    </div>

    <template v-else>
      <div class="doc-actions no-print">
        <p class="ok-tip">所有检查项与签字均已齐备，可打印完成版交接单。</p>
        <button type="button" class="btn primary" @click="printDoc">打印交接单</button>
      </div>

      <div class="handover-doc">
        <h1>出租房交接检查单</h1>
        <p class="doc-meta">
          房屋地址：{{ project.propertyAddress || '（未填写）' }}<br />
          入住检查日期：{{ project.checkIn.date || '（未填写）' }}　
          退租检查日期：{{ project.checkOut.date || '（未填写）' }}
        </p>

        <div v-for="room in comparisons" :key="room.roomId" class="doc-room">
          <h3>{{ room.roomName }}</h3>
          <p>
            钥匙：入住 {{ fmt(room.keysIn) }} 把，退租 {{ fmt(room.keysOut) }} 把；
            水表：{{ fmt(room.waterIn) }} → {{ fmt(room.waterOut) }}（用量 {{ fmt(room.waterUsage) }}）；
            电表：{{ fmt(room.electricityIn) }} → {{ fmt(room.electricityOut) }}（用量 {{ fmt(room.electricityUsage) }}）。
          </p>
          <table class="doc-table">
            <thead>
              <tr>
                <th>设施</th>
                <th>入住状态</th>
                <th>退租状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in room.items" :key="item.itemId">
                <td>{{ item.itemName }}</td>
                <td>{{ statusLabel(item.checkInStatus) }}</td>
                <td>{{ statusLabel(item.checkOutStatus) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="doc-declare">
          双方确认以上设施状态、钥匙数量及水电表读数记录属实，房屋交接手续办理完毕。
        </p>
        <div class="doc-signatures">
          <p>房东签字：{{ project.signatures.landlord }}</p>
          <p>租客签字：{{ project.signatures.tenant }}</p>
        </div>
      </div>
    </template>
  </section>
</template>
