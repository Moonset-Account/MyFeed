<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { Item, Trip } from '../types';
import { addItem, addMember, removeItem, removeMember, reuseTrip } from '../store';
import {
  filterItemsByMember,
  formatWeight,
  itemWeightGrams,
  memberLimitGrams,
  memberLoadGrams,
  packingProgress,
  tripIssues,
  tripWeightGrams,
  type MemberFilter,
} from '../lib/packing';

const props = defineProps<{ trip: Trip }>();
const emit = defineEmits<{ back: []; open: [id: string] }>();

const CATEGORIES = ['衣物', '证件资金', '电子产品', '个护', '健康', '装备', '杂物'];

const filter = ref<MemberFilter>('all');

const newItem = reactive({
  name: '',
  category: '杂物',
  quantity: 1,
  weightGrams: 100,
  shared: false,
  assigneeId: '' as string,
});

const newMember = reactive({ name: '', luggageLimitKg: 20 });

const issues = computed(() => tripIssues(props.trip));
const progress = computed(() => packingProgress(props.trip));

const filteredItems = computed(() => filterItemsByMember(props.trip.items, filter.value));

const groupedItems = computed(() => {
  const groups = new Map<string, Item[]>();
  for (const item of filteredItems.value) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
});

function loadPercent(memberId: string): number {
  const member = props.trip.members.find((m) => m.id === memberId);
  if (!member) return 0;
  const limit = memberLimitGrams(member);
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((memberLoadGrams(props.trip, memberId) / limit) * 100));
}

function isOver(memberId: string): boolean {
  const member = props.trip.members.find((m) => m.id === memberId);
  if (!member) return false;
  return memberLoadGrams(props.trip, memberId) > memberLimitGrams(member);
}

function submitItem(): void {
  const name = newItem.name.trim();
  if (!name) return;
  addItem(props.trip, {
    name,
    category: newItem.category,
    quantity: Math.max(1, Math.floor(newItem.quantity) || 1),
    weightGrams: Math.max(0, Math.round(newItem.weightGrams) || 0),
    shared: newItem.shared,
    assigneeId: newItem.assigneeId === '' ? null : newItem.assigneeId,
    packed: false,
  });
  newItem.name = '';
  newItem.quantity = 1;
  newItem.weightGrams = 100;
  newItem.shared = false;
  newItem.assigneeId = '';
}

function submitMember(): void {
  const name = newMember.name.trim();
  if (!name) return;
  const limit = newMember.luggageLimitKg;
  addMember(props.trip, name, Number.isFinite(limit) && limit > 0 ? limit : 20);
  newMember.name = '';
  newMember.luggageLimitKg = 20;
}

function onRemoveMember(id: string, name: string): void {
  if (window.confirm(`移除成员「${name}」？其名下物品将变为未分配。`)) {
    removeMember(props.trip, id);
  }
}

function onReuse(): void {
  const copy = reuseTrip(props.trip.id);
  if (copy) emit('open', copy.id);
}

function printList(): void {
  window.print();
}

/** 打印视图：按携带人分组的物品 */
const printGroups = computed(() => {
  const groups: { title: string; items: Item[] }[] = [];
  for (const member of props.trip.members) {
    const items = props.trip.items.filter((i) => i.assigneeId === member.id);
    if (items.length > 0) groups.push({ title: member.name, items });
  }
  const rest = props.trip.items.filter((i) => i.assigneeId === null);
  if (rest.length > 0) groups.push({ title: '未分配', items: rest });
  return groups;
});
</script>

<template>
  <div class="no-print">
    <div class="row" style="justify-content: space-between; margin-bottom: 12px">
      <button type="button" @click="emit('back')">← 返回</button>
      <div class="row">
        <button type="button" @click="onReuse">复用此清单</button>
        <button class="primary" type="button" @click="printList">打印清单</button>
      </div>
    </div>

    <section class="card">
      <h1>{{ trip.name }}</h1>
      <p class="muted" style="margin: 0">
        {{ trip.destination }} · {{ trip.days }} 天 · {{ trip.members.length }} 人同行 · 物品总重
        {{ formatWeight(tripWeightGrams(trip)) }}
      </p>
      <div class="progress-track" style="margin-top: 10px">
        <div class="progress-fill" :style="{ width: progress.percent + '%' }"></div>
      </div>
      <p class="muted" style="margin: 4px 0 0">
        已打包 {{ progress.packed }} / {{ progress.total }} 件（{{ progress.percent }}%）
      </p>
    </section>

    <div v-if="issues.length > 0" class="banner">
      <strong>需要注意：</strong>
      <ul>
        <li v-for="(issue, index) in issues" :key="index">{{ issue.message }}</li>
      </ul>
    </div>

    <section class="card">
      <h2>成员与行李负重</h2>
      <div v-for="member in trip.members" :key="member.id" class="member-row">
        <div class="member-head">
          <strong>{{ member.name }}</strong>
          <span :class="isOver(member.id) ? 'badge warn' : 'muted'">
            {{ formatWeight(memberLoadGrams(trip, member.id)) }} / {{ member.luggageLimitKg }} kg
            <template v-if="isOver(member.id)">· 已超重</template>
          </span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="{ over: isOver(member.id) }"
            :style="{ width: loadPercent(member.id) + '%' }"
          ></div>
        </div>
        <div class="row" style="margin-top: 4px">
          <label class="muted">
            限重（kg）
            <input v-model.number="member.luggageLimitKg" type="number" min="1" max="50" step="0.5" />
          </label>
          <button class="link danger" type="button" @click="onRemoveMember(member.id, member.name)">
            移除成员
          </button>
        </div>
      </div>
      <div class="row" style="margin-top: 8px">
        <input v-model="newMember.name" type="text" placeholder="新成员姓名" style="width: 130px" />
        <input
          v-model.number="newMember.luggageLimitKg"
          type="number"
          min="1"
          max="50"
          step="0.5"
          title="行李箱限重（kg）"
        />
        <button type="button" @click="submitMember">+ 添加成员</button>
      </div>
    </section>

    <section class="card">
      <h2>添加物品</h2>
      <div class="row">
        <input
          v-model="newItem.name"
          type="text"
          placeholder="物品名称"
          style="width: 160px"
          @keyup.enter="submitItem"
        />
        <select v-model="newItem.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <label class="muted">数量 <input v-model.number="newItem.quantity" type="number" min="1" /></label>
        <label class="muted"
          >单件重量（g） <input v-model.number="newItem.weightGrams" type="number" min="0" step="10"
        /></label>
        <label class="muted row" style="gap: 4px">
          <input v-model="newItem.shared" type="checkbox" /> 共享物品
        </label>
        <select v-model="newItem.assigneeId">
          <option value="">未分配</option>
          <option v-for="m in trip.members" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <button class="primary" type="button" @click="submitItem">添加</button>
      </div>
    </section>

    <section class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 10px">
        <h2 style="margin: 0">物品清单</h2>
        <div class="tabs">
          <button :class="{ active: filter === 'all' }" type="button" @click="filter = 'all'">
            全部
          </button>
          <button
            :class="{ active: filter === 'unassigned' }"
            type="button"
            @click="filter = 'unassigned'"
          >
            未分配
          </button>
          <button
            v-for="m in trip.members"
            :key="m.id"
            :class="{ active: filter === m.id }"
            type="button"
            @click="filter = m.id"
          >
            {{ m.name }}
          </button>
        </div>
      </div>

      <p v-if="filteredItems.length === 0" class="muted">当前筛选下没有物品。</p>

      <div v-for="[category, items] in groupedItems" :key="category" class="category-group">
        <h3>{{ category }}</h3>
        <div v-for="item in items" :key="item.id" class="item-row" :class="{ packed: item.packed }">
          <input v-model="item.packed" type="checkbox" :title="item.packed ? '已打包' : '标记已打包'" />
          <span class="item-name">
            {{ item.name }}
            <span v-if="item.shared" class="badge">共享</span>
          </span>
          <label class="muted">×<input v-model.number="item.quantity" type="number" min="1" /></label>
          <label class="muted"
            ><input v-model.number="item.weightGrams" type="number" min="0" step="10" /> g/件</label
          >
          <span class="muted" style="min-width: 64px; text-align: right">
            {{ formatWeight(itemWeightGrams(item)) }}
          </span>
          <select v-model="item.assigneeId">
            <option :value="null">未分配</option>
            <option v-for="m in trip.members" :key="m.id" :value="m.id">
              {{ item.shared ? `负责人：${m.name}` : m.name }}
            </option>
          </select>
          <span v-if="item.shared && item.assigneeId === null" class="badge warn">需指定负责人</span>
          <button class="link danger" type="button" @click="removeItem(trip, item.id)">删除</button>
        </div>
      </div>
    </section>
  </div>

  <!-- 打印视图 -->
  <div class="print-only">
    <h1>{{ trip.name }} · 打包清单</h1>
    <p>
      {{ trip.destination }} · {{ trip.days }} 天 · {{ trip.members.length }} 人同行 · 物品总重
      {{ formatWeight(tripWeightGrams(trip)) }} · 已打包 {{ progress.packed }} /
      {{ progress.total }} 件
    </p>
    <div v-for="group in printGroups" :key="group.title" class="print-group">
      <h2>{{ group.title }}</h2>
      <ul>
        <li v-for="item in group.items" :key="item.id">
          <span class="box">{{ item.packed ? '☑' : '☐' }}</span>
          {{ item.name }}<template v-if="item.quantity > 1"> ×{{ item.quantity }}</template>
          <template v-if="item.shared">（共享）</template>
          — {{ formatWeight(itemWeightGrams(item)) }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.member-row {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.member-row:first-of-type {
  border-top: none;
}

.member-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.member-head label {
  font-size: 12px;
}

.category-group h3 {
  font-size: 14px;
  color: var(--muted);
  margin: 14px 0 6px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 0;
}

.item-row.packed .item-name {
  text-decoration: line-through;
  color: var(--muted);
}

.item-name {
  flex: 1;
  min-width: 140px;
}

.item-row label {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.print-group h2 {
  font-size: 15px;
  margin: 14px 0 6px;
  border-bottom: 1px solid #999;
  padding-bottom: 4px;
}

.print-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.print-group li {
  padding: 3px 0;
  font-size: 13px;
}

.print-group .box {
  display: inline-block;
  width: 18px;
}
</style>
