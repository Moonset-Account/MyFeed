<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { OrderStatus, OrderSummary, ServiceItem } from '../../shared/domain';
import { api, type ListParams, type OrderView } from './api';
import OrderForm from './components/OrderForm.vue';
import OrderBoard from './components/OrderBoard.vue';
import SummaryBar from './components/SummaryBar.vue';

const services = ref<ServiceItem[]>([]);
const orders = ref<OrderView[]>([]);
const summary = ref<OrderSummary | null>(null);
const today = ref('');
const loading = ref(false);
const error = ref('');

const filter = ref<ListParams>({ status: '', overdueOnly: false, q: '' });

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    const [listRes, summaryRes] = await Promise.all([
      api.listOrders(filter.value),
      api.summary(),
    ]);
    orders.value = listRes.orders;
    today.value = listRes.today;
    summary.value = summaryRes.summary;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function setStatusFilter(status: OrderStatus | '') {
  filter.value.status = status;
  void refresh();
}

function setOverdueOnly(value: boolean) {
  filter.value.overdueOnly = value;
  void refresh();
}

function setQuery(q: string) {
  filter.value.q = q;
  void refresh();
}

onMounted(async () => {
  try {
    services.value = (await api.services()).services;
  } catch (err) {
    error.value = (err as Error).message;
  }
  await refresh();
});
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>洗衣店订单流转台</h1>
      <p class="subtitle">接单 → 清洗 → 质检 → 待领取 → 已取件</p>
    </header>

    <p v-if="error" class="error-banner">后端连接异常:{{ error }}</p>

    <SummaryBar v-if="summary" :summary="summary" :today="today" />

    <main class="layout">
      <section class="panel">
        <h2>新建订单</h2>
        <OrderForm :services="services" @created="refresh" />
      </section>

      <section class="panel board-panel">
        <OrderBoard
          :orders="orders"
          :loading="loading"
          :filter="filter"
          @filter-status="setStatusFilter"
          @filter-overdue="setOverdueOnly"
          @filter-query="setQuery"
          @changed="refresh"
        />
      </section>
    </main>
  </div>
</template>
