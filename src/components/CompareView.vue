<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  compareInspections,
  finalBlockers,
  canGenerateFinal,
  type Project,
} from '../logic/inspection'

const props = defineProps<{ project: Project }>()

const rows = computed(() => compareInspections(props.project))
const blockers = computed(() => finalBlockers(props.project))
const ready = computed(() => canGenerateFinal(props.project))

const finalGenerated = ref(false)
const generatedAt = ref('')

function generate() {
  if (!ready.value) return
  generatedAt.value = new Date().toLocaleString('zh-CN')
  finalGenerated.value = true
}

function printReport() {
  window.print()
}
</script>

<template>
  <section class="compare-view">
    <div class="no-print">
    <h2>入住 / 退租逐项对比</h2>

    <table class="compare-table">
      <thead>
        <tr>
          <th>房间</th>
          <th>项目</th>
          <th>入住检查</th>
          <th>退租检查</th>
          <th>变化</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i" :class="{ changed: row.changed }">
          <td>{{ row.roomName }}</td>
          <td>{{ row.item }}</td>
          <td>{{ row.checkinValue }}</td>
          <td>{{ row.checkoutValue }}</td>
          <td>{{ row.changed ? '有变化' : '—' }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="!ready" class="blockers">
      <h3>存在缺项，暂不能生成完成版交接单</h3>
      <div class="blocker-columns">
        <div>
          <h4>入住检查缺项</h4>
          <p v-if="blockers.checkin.length === 0">无</p>
          <ul>
            <li v-for="(m, i) in blockers.checkin" :key="i">{{ m.roomName }}：{{ m.field }}</li>
          </ul>
        </div>
        <div>
          <h4>退租检查缺项</h4>
          <p v-if="blockers.checkout.length === 0">无</p>
          <ul>
            <li v-for="(m, i) in blockers.checkout" :key="i">{{ m.roomName }}：{{ m.field }}</li>
          </ul>
        </div>
      </div>
    </div>
    </div>

    <div class="actions no-print">
      <button class="primary" :disabled="!ready" @click="generate">
        生成完成版交接单
      </button>
      <button v-if="finalGenerated" @click="printReport">打印交接单</button>
    </div>

    <div v-if="finalGenerated && ready" id="final-report" class="final-report">
      <h2>出租房交接单（完成版）</h2>
      <p class="report-meta">
        房屋地址：{{ project.address || '（未填写）' }}<br />
        入住检查日期：{{ project.checkin.date }}　退租检查日期：{{ project.checkout.date }}<br />
        生成时间：{{ generatedAt }}
      </p>

      <table class="compare-table">
        <thead>
          <tr>
            <th>房间</th>
            <th>项目</th>
            <th>入住时</th>
            <th>退租时</th>
            <th>变化</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i" :class="{ changed: row.changed }">
            <td>{{ row.roomName }}</td>
            <td>{{ row.item }}</td>
            <td>{{ row.checkinValue }}</td>
            <td>{{ row.checkoutValue }}</td>
            <td>{{ row.changed ? '有变化' : '无' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="report-photos">
        <h3>照片说明</h3>
        <div v-for="room in project.rooms" :key="room.id" class="photo-row">
          <strong>{{ room.name }}</strong>
          <p>入住：{{ project.checkin.rooms[room.id]?.photoNote || '（无）' }}</p>
          <p>退租：{{ project.checkout.rooms[room.id]?.photoNote || '（无）' }}</p>
        </div>
      </div>

      <div class="signature-block">
        <div>
          <h4>入住检查签字</h4>
          <p>出租方：{{ project.checkin.landlordName }}</p>
          <p>承租方：{{ project.checkin.tenantName }}</p>
        </div>
        <div>
          <h4>退租检查签字</h4>
          <p>出租方：{{ project.checkout.landlordName }}</p>
          <p>承租方：{{ project.checkout.tenantName }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
