<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()
const label = computed(() => {
  const labels: Record<string, string> = {
    waiting: '候位中',
    called: '已叫号',
    seated: '已入座',
    missed: '过号',
    cancelled: '已取消',
    left: '已离店',
    free: '空闲',
    occupied: '使用中',
  }
  return labels[props.status] ?? props.status
})
</script>

<template>
  <span class="badge" :data-status="status">{{ label }}</span>
</template>
