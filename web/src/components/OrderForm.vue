<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { ServiceItem } from '../../../shared/domain';
import { computeAmountCents, formatYuan, todayString } from '../../../shared/domain';
import { api } from '../api';

const props = defineProps<{ services: ServiceItem[] }>();
const emit = defineEmits<{ created: [] }>();

const form = reactive({
  customerName: '',
  phone: '',
  itemCount: 1,
  serviceIds: [] as string[],
  pickupDate: todayString(),
  stainNotes: '',
});

const submitting = ref(false);
const error = ref('');
const okMsg = ref('');

const amountPreview = computed(() =>
  computeAmountCents(form.serviceIds, Number(form.itemCount) || 0),
);

function toggleService(id: string) {
  const i = form.serviceIds.indexOf(id);
  if (i >= 0) form.serviceIds.splice(i, 1);
  else form.serviceIds.push(id);
}

async function submit() {
  error.value = '';
  okMsg.value = '';
  if (form.serviceIds.length === 0) {
    error.value = '请至少选择一项服务';
    return;
  }
  submitting.value = true;
  try {
    const { order } = await api.createOrder({
      customerName: form.customerName,
      phone: form.phone,
      itemCount: Number(form.itemCount),
      serviceIds: form.serviceIds,
      pickupDate: form.pickupDate,
      stainNotes: form.stainNotes,
    });
    okMsg.value = `已接单 ${order.code},进入清洗`;
    form.customerName = '';
    form.phone = '';
    form.itemCount = 1;
    form.serviceIds = [];
    form.pickupDate = todayString();
    form.stainNotes = '';
    emit('created');
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="order-form" @submit.prevent="submit">
    <label>
      顾客姓名
      <input v-model="form.customerName" required placeholder="张阿姨" />
    </label>
    <label>
      联系电话
      <input v-model="form.phone" required placeholder="13800000000" />
    </label>
    <label>
      衣物件数
      <input v-model.number="form.itemCount" type="number" min="1" max="999" required />
    </label>
    <label>
      约定取件日期
      <input v-model="form.pickupDate" type="date" required />
    </label>

    <fieldset class="service-picker">
      <legend>服务项目</legend>
      <label v-for="s in props.services" :key="s.id" class="service-option">
        <input
          type="checkbox"
          :checked="form.serviceIds.includes(s.id)"
          @change="toggleService(s.id)"
        />
        <span>{{ s.name }}({{ formatYuan(s.priceCents) }}/件)</span>
      </label>
    </fieldset>

    <label>
      特殊污渍备注
      <textarea
        v-model="form.stainNotes"
        rows="2"
        placeholder="如:领口油渍、红酒渍,需重点处理"
      ></textarea>
    </label>

    <div class="form-footer">
      <span class="amount-preview">预估金额 {{ formatYuan(amountPreview) }}</span>
      <button type="submit" :disabled="submitting">{{ submitting ? '提交中…' : '接单' }}</button>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="okMsg" class="form-ok">{{ okMsg }}</p>
  </form>
</template>
