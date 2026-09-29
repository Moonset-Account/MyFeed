<script setup lang="ts">
import type { OrderSummary } from '../../../shared/domain';
import { formatYuan, STATUS_LABELS } from '../../../shared/domain';

defineProps<{ summary: OrderSummary; today: string }>();
</script>

<template>
  <section class="summary-bar">
    <div class="stat">
      <span class="stat-label">在途订单</span>
      <span class="stat-value">{{ summary.activeOrders }}</span>
      <span class="stat-sub">{{ formatYuan(summary.activeAmountCents) }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">{{ STATUS_LABELS.ready }}</span>
      <span class="stat-value">{{ summary.byStatus.ready }}</span>
      <span class="stat-sub">{{ formatYuan(summary.readyAmountCents) }}</span>
    </div>
    <div class="stat">
      <span class="stat-label">已取件回款</span>
      <span class="stat-value">{{ summary.byStatus.picked_up }}</span>
      <span class="stat-sub">{{ formatYuan(summary.pickedUpAmountCents) }}</span>
    </div>
    <div class="stat" :class="{ 'stat-danger': summary.overdueCount > 0 }">
      <span class="stat-label">逾期未取</span>
      <span class="stat-value">{{ summary.overdueCount }}</span>
      <span class="stat-sub">{{ formatYuan(summary.overdueAmountCents) }}</span>
    </div>
    <div class="stat stat-today">
      <span class="stat-label">今天</span>
      <span class="stat-value stat-date">{{ today }}</span>
    </div>
  </section>
</template>
