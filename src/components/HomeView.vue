<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { state, createTrip, deleteTrip, reuseTrip } from '../store';
import { overLimitMembers, packingProgress } from '../lib/packing';

const emit = defineEmits<{ open: [id: string] }>();

interface MemberForm {
  name: string;
  luggageLimitKg: number;
}

const form = reactive({
  name: '',
  destination: '',
  days: 3,
  members: [{ name: '', luggageLimitKg: 20 }] as MemberForm[],
});

const formError = ref('');

function addMemberRow(): void {
  form.members.push({ name: '', luggageLimitKg: 20 });
}

function removeMemberRow(index: number): void {
  form.members.splice(index, 1);
}

function submit(): void {
  formError.value = '';
  const destination = form.destination.trim();
  if (!destination) {
    formError.value = '请填写目的地';
    return;
  }
  const days = Math.floor(form.days);
  if (!Number.isFinite(days) || days < 1) {
    formError.value = '行程天数至少为 1 天';
    return;
  }
  const members = form.members
    .map((m) => ({ name: m.name.trim(), luggageLimitKg: m.luggageLimitKg }))
    .filter((m) => m.name !== '');
  if (members.length === 0) {
    formError.value = '请至少添加一名成员';
    return;
  }
  for (const m of members) {
    if (!Number.isFinite(m.luggageLimitKg) || m.luggageLimitKg <= 0) {
      formError.value = `成员「${m.name}」的行李箱限重需大于 0`;
      return;
    }
  }
  const trip = createTrip({ name: form.name, destination, days, members });
  form.name = '';
  form.destination = '';
  form.days = 3;
  form.members = [{ name: '', luggageLimitKg: 20 }];
  emit('open', trip.id);
}

const trips = computed(() => [...state.trips].sort((a, b) => b.updatedAt - a.updatedAt));

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function onReuse(id: string): void {
  const copy = reuseTrip(id);
  if (copy) emit('open', copy.id);
}

function onDelete(id: string, name: string): void {
  if (window.confirm(`确定删除行程「${name}」吗？此操作不可恢复。`)) {
    deleteTrip(id);
  }
}
</script>

<template>
  <h1>多人旅行打包清单</h1>
  <p class="muted">按目的地与行程天数生成物品，分配携带人，实时核对行李重量。</p>

  <section class="card">
    <h2>新建行程</h2>
    <div class="row" style="margin-bottom: 8px">
      <label>
        行程名称（可选）
        <input v-model="form.name" type="text" placeholder="默认按目的地命名" style="width: 180px" />
      </label>
      <label>
        目的地
        <input v-model="form.destination" type="text" placeholder="如：三亚海边" style="width: 160px" />
      </label>
      <label>
        行程天数
        <input v-model.number="form.days" type="number" min="1" max="60" />
      </label>
    </div>

    <div v-for="(member, index) in form.members" :key="index" class="row" style="margin-bottom: 6px">
      <label>
        成员
        <input v-model="member.name" type="text" placeholder="姓名" style="width: 120px" />
      </label>
      <label>
        行李箱限重（kg）
        <input v-model.number="member.luggageLimitKg" type="number" min="1" max="50" step="0.5" />
      </label>
      <button
        v-if="form.members.length > 1"
        class="link danger"
        type="button"
        @click="removeMemberRow(index)"
      >
        移除
      </button>
    </div>

    <div class="row">
      <button type="button" @click="addMemberRow">+ 添加成员</button>
      <button class="primary" type="button" @click="submit">生成打包清单</button>
      <span v-if="formError" class="badge warn">{{ formError }}</span>
    </div>
    <p class="muted" style="margin-bottom: 0">
      提交后会按目的地（如海边、雪山、徒步）与天数自动生成建议物品，可在清单中继续调整。
    </p>
  </section>

  <section v-if="trips.length > 0" class="card">
    <h2>历史清单</h2>
    <div v-for="trip in trips" :key="trip.id" class="trip-row">
      <div class="trip-main">
        <div class="row">
          <strong>{{ trip.name }}</strong>
          <span v-if="overLimitMembers(trip).length > 0" class="badge warn">有成员超重</span>
        </div>
        <div class="muted">
          {{ trip.destination }} · {{ trip.days }} 天 · {{ trip.members.length }} 人 ·
          更新于 {{ formatTime(trip.updatedAt) }}
        </div>
        <div class="progress-track" style="margin-top: 6px; max-width: 280px">
          <div class="progress-fill" :style="{ width: packingProgress(trip).percent + '%' }"></div>
        </div>
        <div class="muted">
          已打包 {{ packingProgress(trip).packed }} / {{ packingProgress(trip).total }} 件
        </div>
      </div>
      <div class="row">
        <button class="primary" type="button" @click="emit('open', trip.id)">打开</button>
        <button type="button" @click="onReuse(trip.id)">复用为新一轮</button>
        <button class="danger" type="button" @click="onDelete(trip.id, trip.name)">删除</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
label {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: var(--muted);
}

.trip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.trip-row:first-of-type {
  border-top: none;
}

.trip-main {
  min-width: 240px;
}
</style>
