<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TransitionAction } from '../../../shared/domain';
import {
  availableActions,
  formatYuan,
  SERVICE_CATALOG,
  STATUS_LABELS,
  TRANSITIONS,
} from '../../../shared/domain';
import { api, type OrderView } from '../api';

const props = defineProps<{ order: OrderView }>();
const emit = defineEmits<{ changed: [] }>();

const showHistory = ref(false);
const failMode = ref(false);
const failNote = ref('');
const busy = ref(false);
const error = ref('');

const serviceNames = computed(() =>
  props.order.serviceIds
    .map((id) => SERVICE_CATALOG.find((s) => s.id === id)?.name ?? id)
    .join('、'),
);

const stainNotesText = computed(() => {
  const text = props.order.stainNotes;
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
});

const actions = computed(() => availableActions(props.order.status));

async function run(action: TransitionAction, note?: string) {
  busy.value = true;
  error.value = '';
  try {
    await api.transition(props.order.id, action, note);
    failMode.value = false;
    failNote.value = '';
    emit('changed');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

function onAction(action: TransitionAction) {
  if (action === 'fail_qc') {
    failMode.value = true;
    return;
  }
  void run(action);
}

function confirmFail() {
  if (!failNote.value.trim()) {
    error.value = '请填写退回原因';
    return;
  }
  void run('fail_qc', failNote.value);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
</script>

<template>
  <article class="card" :class="{ overdue: order.overdue }">
    <header class="card-head">
      <span class="code">{{ order.code }}</span>
      <span v-if="order.overdue" class="badge-overdue">逾期未取</span>
      <span class="amount">{{ formatYuan(order.amountCents) }}</span>
    </header>
    <p class="line">
      <strong>{{ order.customerName }}</strong>
      <span class="muted">{{ order.phone }}</span>
    </p>
    <p class="line">{{ order.itemCount }} 件 · {{ serviceNames }}</p>
    <p class="line muted">约定取件:{{ order.pickupDate }}</p>
    <p v-if="order.stainNotes" class="line stain">污渍备注:{{ stainNotesText }}</p>

    <div class="actions">
      <button
        v-for="a in actions"
        :key="a"
        :class="['action', `action-${a}`]"
        :disabled="busy"
        @click="onAction(a)"
      >
        {{ TRANSITIONS[a].label }}
      </button>
      <button class="action action-history" @click="showHistory = !showHistory">
        {{ showHistory ? '收起记录' : '流转记录' }}
      </button>
    </div>

    <div v-if="failMode" class="fail-box">
      <textarea
        v-model="failNote"
        rows="2"
        placeholder="退回原因(必填),如:袖口油渍未洗净"
      ></textarea>
      <div class="fail-actions">
        <button :disabled="busy" @click="confirmFail">确认退回重洗</button>
        <button :disabled="busy" @click="failMode = false">取消</button>
      </div>
    </div>

    <p v-if="error" class="card-error">{{ error }}</p>

    <ul v-if="showHistory" class="history">
      <li v-for="(h, i) in order.history" :key="i">
        <span class="history-time">{{ fmtTime(h.at) }}</span>
        <span>
          {{ h.label }}
          <template v-if="h.from">({{ STATUS_LABELS[h.from] }} → {{ STATUS_LABELS[h.to] }})</template>
        </span>
        <span v-if="h.note" class="history-note">原因:{{ h.note }}</span>
      </li>
    </ul>
  </article>
</template>
