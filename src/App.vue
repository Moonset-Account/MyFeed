<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRepairStore } from './composables/useRepairStore';
import {
  canBorrow,
  createEmptyChecklist,
  findRecordsByBookNumber,
  INSPECTION_ITEMS,
  normalizeBookNumber,
  normalizeLines,
  recordsToCsv,
  STATUS_LABELS,
  type RepairRecord,
  type RepairStatus,
} from './core/repairs';

type StatusFilter = 'all' | RepairStatus;

const store = useRepairStore();

const registrationForm = reactive({
  bookNumber: '',
  damageLocation: '',
  photoNote: '',
  repairSteps: '',
  handler: '',
});
const formError = ref('');
const statusFilter = ref<StatusFilter>('all');
const listBookNumber = ref('');
const historyBookNumber = ref('');
const historySearched = ref(false);
const actionError = ref('');
const inspectingRecord = ref<RepairRecord | null>(null);
const inspectionForm = reactive({
  inspector: '',
  checklist: createEmptyChecklist(),
});

const filteredRecords = computed<RepairRecord[]>(() => {
  const keyword = listBookNumber.value;
  return store.records.value.filter((record) => {
    const matchesStatus = statusFilter.value === 'all' || record.status === statusFilter.value;
    const matchesBookNumber = !keyword || record.bookNumber.includes(normalizeBookNumber(keyword));
    return matchesStatus && matchesBookNumber;
  });
});

const historyRecords = computed<RepairRecord[]>(() =>
  historySearched.value ? findRecordsByBookNumber(store.records.value, historyBookNumber.value) : [],
);

const statusCounts = computed(() => [
  { key: 'all', label: '全部', count: store.stats.value.total },
  { key: 'pending_evaluation', label: STATUS_LABELS.pending_evaluation, count: store.stats.value.pendingEvaluation },
  { key: 'repairing', label: STATUS_LABELS.repairing, count: store.stats.value.repairing },
  { key: 'pending_shelving', label: STATUS_LABELS.pending_shelving, count: store.stats.value.pendingShelving },
]);

function resetRegistrationForm(): void {
  registrationForm.bookNumber = '';
  registrationForm.damageLocation = '';
  registrationForm.photoNote = '';
  registrationForm.repairSteps = '';
  registrationForm.handler = '';
  formError.value = '';
}

function submitRegistration(): void {
  try {
    store.addRecord({
      bookNumber: registrationForm.bookNumber,
      damageLocation: registrationForm.damageLocation,
      photoNote: registrationForm.photoNote,
      repairSteps: normalizeLines(registrationForm.repairSteps),
      handler: registrationForm.handler,
    });
    resetRegistrationForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '登记失败，请检查输入';
  }
}

function nextActionLabel(record: RepairRecord): string {
  if (record.status === 'pending_evaluation') {
    return '开始修补';
  }
  if (record.status === 'repairing') {
    return '修补完成，转待上架';
  }
  return canBorrow(record) ? '已完成检查' : '完成上架检查';
}

function advance(record: RepairRecord): void {
  try {
    store.moveForward(record.id);
    actionError.value = '';
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '状态更新失败';
  }
}

function openInspection(record: RepairRecord): void {
  inspectingRecord.value = record;
  inspectionForm.inspector = record.handler;
  inspectionForm.checklist = createEmptyChecklist();
  actionError.value = '';
}

function closeInspection(): void {
  inspectingRecord.value = null;
  actionError.value = '';
}

function submitInspection(): void {
  if (!inspectingRecord.value) {
    return;
  }
  try {
    store.finishInspection(inspectingRecord.value.id, {
      inspector: inspectionForm.inspector,
      checklist: { ...inspectionForm.checklist },
    });
    closeInspection();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '检查未完成';
  }
}

function handlePrimaryAction(record: RepairRecord): void {
  if (record.status === 'pending_shelving') {
    if (!canBorrow(record)) {
      openInspection(record);
    }
    return;
  }
  advance(record);
}

function runHistorySearch(): void {
  historySearched.value = true;
}

function confirmResetDemo(): void {
  if (window.confirm('确定用内置演示记录替换当前浏览器里的登记数据吗？')) {
    store.resetDemoRecords();
  }
}

function confirmClearRecords(): void {
  if (window.confirm('确定清空当前浏览器中的全部修补记录吗？')) {
    store.clearRecords();
  }
}

function downloadCsv(): void {
  const csv = recordsToCsv(filteredRecords.value);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `图书修补清单-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClass(status: RepairStatus): string {
  return `status-badge status-${status}`;
}
</script>

<template>
  <main class="app-shell">
    <header class="page-header">
      <div>
        <p class="eyebrow">图书馆流通维护</p>
        <h1>图书修补登记册</h1>
        <p class="subtitle">按书号追踪破损、修补步骤、处理人和上架检查，未完成检查的图书不会标记为可借。</p>
      </div>
      <div class="header-note">
        <span>本地离线演示</span>
        <small>数据保存在当前浏览器</small>
      </div>
    </header>

    <section class="stats-grid" aria-label="待办统计">
      <article class="stat-card stat-todo">
        <span>当前待办</span>
        <strong>{{ store.stats.value.todo }}</strong>
        <small>待评估 + 修补中 + 待检查</small>
      </article>
      <article class="stat-card">
        <span>待评估</span>
        <strong>{{ store.stats.value.pendingEvaluation }}</strong>
      </article>
      <article class="stat-card">
        <span>修补中</span>
        <strong>{{ store.stats.value.repairing }}</strong>
      </article>
      <article class="stat-card">
        <span>待上架</span>
        <strong>{{ store.stats.value.pendingShelving }}</strong>
        <small>{{ store.stats.value.awaitingInspection }} 本待检查，{{ store.stats.value.available }} 本可借</small>
      </article>
    </section>

    <section class="panel form-panel">
      <div class="section-heading">
        <div>
          <h2>登记破损图书</h2>
          <p>同一书号可重复登记，系统会保留每次修补历史。</p>
        </div>
      </div>

      <form class="registration-grid" @submit.prevent="submitRegistration">
        <label>
          书号
          <input v-model="registrationForm.bookNumber" type="text" placeholder="例如 B-1001" autocomplete="off" />
        </label>
        <label>
          处理人
          <input v-model="registrationForm.handler" type="text" placeholder="登记 / 修补处理人" autocomplete="off" />
        </label>
        <label class="wide-field">
          破损位置
          <input v-model="registrationForm.damageLocation" type="text" placeholder="例如 第 36 页中缝脱胶" autocomplete="off" />
        </label>
        <label class="wide-field">
          照片说明
          <textarea v-model="registrationForm.photoNote" rows="3" placeholder="记录照片编号、拍摄角度和可见破损；演示版不上传图片"></textarea>
        </label>
        <label class="wide-field">
          修补步骤
          <textarea v-model="registrationForm.repairSteps" rows="4" placeholder="每行一条，例如：&#10;清除残胶&#10;重新刷胶并压平"></textarea>
        </label>
        <div class="form-actions wide-field">
          <button class="primary-button" type="submit">登记并进入待评估</button>
          <button type="button" @click="resetRegistrationForm">清空</button>
        </div>
      </form>
      <p v-if="formError" class="error-message" role="alert">{{ formError }}</p>
      <p v-if="store.storageError.value" class="warning-message" role="alert">{{ store.storageError.value }}</p>
    </section>

    <section class="panel history-panel">
      <div class="section-heading">
        <div>
          <h2>按书号查历史</h2>
          <p>输入完整或部分书号，显示该书的所有修补登记。</p>
        </div>
      </div>
      <div class="inline-search">
        <input v-model="historyBookNumber" type="search" placeholder="例如 B-1001" @keydown.enter="runHistorySearch" />
        <button class="secondary-button" type="button" @click="runHistorySearch">查询历史</button>
      </div>

      <div v-if="historySearched" class="history-results">
        <template v-if="historyRecords.length">
          <article v-for="record in historyRecords" :key="record.id" class="history-item">
            <div>
              <strong>{{ record.bookNumber }}</strong>
              <span :class="statusClass(record.status)">{{ STATUS_LABELS[record.status] }}</span>
              <span :class="canBorrow(record) ? 'available yes' : 'available no'">
                {{ canBorrow(record) ? '可借' : '不可借' }}
              </span>
            </div>
            <p>{{ record.damageLocation }} · {{ record.handler }} · {{ formatDateTime(record.createdAt) }}</p>
          </article>
        </template>
        <p v-else class="empty-state">没有找到这个书号的修补记录。</p>
      </div>
    </section>

    <section class="panel records-panel">
      <div class="section-heading records-heading">
        <div>
          <h2>修补流转清单</h2>
          <p>共 {{ filteredRecords.length }} 条当前筛选结果。</p>
        </div>
        <div class="toolbar">
          <button class="secondary-button" type="button" @click="downloadCsv" :disabled="filteredRecords.length === 0">
            导出筛选清单
          </button>
          <button type="button" @click="confirmResetDemo()">恢复演示数据</button>
          <button class="danger-button" type="button" @click="confirmClearRecords()">清空本地数据</button>
        </div>
      </div>

      <div class="list-controls">
        <input v-model="listBookNumber" type="search" placeholder="在清单中筛选书号" />
        <div class="filter-tabs" role="group" aria-label="按状态筛选">
          <button
            v-for="item in statusCounts"
            :key="item.key"
            type="button"
            :class="{ active: statusFilter === item.key }"
            @click="statusFilter = item.key as StatusFilter"
          >
            {{ item.label }} <span>{{ item.count }}</span>
          </button>
        </div>
      </div>

      <p v-if="actionError" class="error-message" role="alert">{{ actionError }}</p>

      <div v-if="filteredRecords.length" class="record-grid">
        <article v-for="record in filteredRecords" :key="record.id" class="record-card">
          <div class="record-topline">
            <div>
              <span class="book-number">{{ record.bookNumber }}</span>
              <span :class="statusClass(record.status)">{{ STATUS_LABELS[record.status] }}</span>
            </div>
            <span :class="canBorrow(record) ? 'available yes' : 'available no'">
              {{ canBorrow(record) ? '✓ 可借' : '不可借' }}
            </span>
          </div>

          <dl>
            <div>
              <dt>破损位置</dt>
              <dd>{{ record.damageLocation }}</dd>
            </div>
            <div>
              <dt>照片说明</dt>
              <dd>{{ record.photoNote }}</dd>
            </div>
            <div>
              <dt>修补步骤</dt>
              <dd>
                <ol class="step-list">
                  <li v-for="step in record.repairSteps" :key="step">{{ step }}</li>
                </ol>
              </dd>
            </div>
            <div class="record-meta">
              <span>处理人：{{ record.handler }}</span>
              <span>登记：{{ formatDateTime(record.createdAt) }}</span>
              <span>更新：{{ formatDateTime(record.updatedAt) }}</span>
            </div>
          </dl>

          <div v-if="record.status === 'pending_shelving' && record.inspection" class="inspection-summary">
            <strong>检查人：{{ record.inspection.inspector }}</strong>
            <span>{{ formatDateTime(record.inspection.at) }} 完成 {{ INSPECTION_ITEMS.length }} 项检查</span>
          </div>

          <details class="timeline-details">
            <summary>查看流转记录</summary>
            <ol class="timeline-list">
              <li v-for="event in record.timeline" :key="`${event.at}-${event.type}`">
                <span>{{ formatDateTime(event.at) }}</span>
                <strong>{{ event.actor }}</strong>
                <p>{{ event.detail }}</p>
              </li>
            </ol>
          </details>

          <button
            class="primary-button"
            type="button"
            :disabled="record.status === 'pending_shelving' && canBorrow(record)"
            @click="handlePrimaryAction(record)"
          >
            {{ nextActionLabel(record) }}
          </button>
        </article>
      </div>
      <p v-else class="empty-state">当前筛选条件下没有记录。</p>
    </section>

    <div v-if="inspectingRecord" class="modal-backdrop" @click.self="closeInspection">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="inspection-title">
        <div class="section-heading">
          <div>
            <h2 id="inspection-title">上架前检查</h2>
            <p>{{ inspectingRecord.bookNumber }} · {{ inspectingRecord.damageLocation }}</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeInspection">×</button>
        </div>

        <form class="inspection-form" @submit.prevent="submitInspection">
          <label>
            检查人
            <input v-model="inspectionForm.inspector" type="text" placeholder="请输入检查人姓名" />
          </label>
          <fieldset>
            <legend>检查项目</legend>
            <label v-for="item in INSPECTION_ITEMS" :key="item" class="check-row">
              <input v-model="inspectionForm.checklist[item]" type="checkbox" />
              <span>{{ item }}</span>
            </label>
          </fieldset>
          <p v-if="actionError" class="error-message" role="alert">{{ actionError }}</p>
          <div class="modal-actions">
            <button class="primary-button" type="submit">全部通过，标记可借</button>
            <button type="button" @click="closeInspection">稍后检查</button>
          </div>
        </form>
      </section>
    </div>
  </main>
</template>
