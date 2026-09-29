<script setup lang="ts">
import { computed, ref } from 'vue';
import type { OrderStatus } from '../../../shared/domain';
import { STATUS_LABELS, STATUS_ORDER } from '../../../shared/domain';
import type { ListParams, OrderView } from '../api';
import OrderCard from './OrderCard.vue';

const props = defineProps<{
  orders: OrderView[];
  loading: boolean;
  filter: ListParams;
}>();

const emit = defineEmits<{
  'filter-status': [status: OrderStatus | ''];
  'filter-overdue': [value: boolean];
  'filter-query': [q: string];
  changed: [];
}>();

const query = ref(props.filter.q ?? '');

const grouped = computed(() => {
  const map = new Map<OrderStatus, OrderView[]>(STATUS_ORDER.map((s) => [s, []]));
  for (const o of props.orders) map.get(o.status)?.push(o);
  return STATUS_ORDER.map((s) => ({ status: s, label: STATUS_LABELS[s], list: map.get(s)! }));
});

let timer: ReturnType<typeof setTimeout> | undefined;
function onQueryInput() {
  clearTimeout(timer);
  timer = setTimeout(() => emit('filter-query', query.value), 250);
}
</script>

<template>
  <div class="board-header">
    <div class="status-tabs">
      <button
        :class="{ active: filter.status === '' }"
        @click="emit('filter-status', '')"
      >
        全部
      </button>
      <button
        v-for="s in STATUS_ORDER"
        :key="s"
        :class="{ active: filter.status === s }"
        @click="emit('filter-status', s)"
      >
        {{ STATUS_LABELS[s] }}
      </button>
    </div>
    <div class="board-tools">
      <label class="overdue-toggle">
        <input
          type="checkbox"
          :checked="filter.overdueOnly"
          @change="emit('filter-overdue', ($event.target as HTMLInputElement).checked)"
        />
        仅看逾期未取
      </label>
      <input
        v-model="query"
        class="search"
        placeholder="搜索单号 / 姓名 / 电话"
        @input="onQueryInput"
      />
    </div>
  </div>

  <p v-if="loading" class="loading">加载中…</p>
  <p v-else-if="orders.length === 0" class="empty">没有符合条件的订单</p>

  <div v-else class="columns">
    <div v-for="col in grouped" :key="col.status" class="column">
      <h3>
        {{ col.label }}
        <span class="count">{{ col.list.length }}</span>
      </h3>
      <OrderCard
        v-for="order in col.list"
        :key="order.id"
        :order="order"
        @changed="emit('changed')"
      />
    </div>
  </div>
</template>
