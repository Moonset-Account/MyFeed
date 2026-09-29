<script setup lang="ts">
import { reactive, ref } from 'vue'
import { toDateTimeInputValue } from '../restaurant/time'
import { useWaitlistStore } from '../restaurant/store'

const store = useWaitlistStore()
const form = reactive({
  name: '',
  size: 2,
  arrivalTime: toDateTimeInputValue(),
  acceptShare: false,
})
const submitted = ref(false)

const submit = () => {
  submitted.value = true
  store.register({ ...form, size: Number(form.size) })
  if (!store.error.value) {
    form.name = ''
    form.size = 2
    form.arrivalTime = toDateTimeInputValue()
    form.acceptShare = false
    submitted.value = false
  }
}
</script>

<template>
  <section class="card register-card">
    <div class="section-title">
      <div>
        <p class="eyebrow">前台登记</p>
        <h2>登记候位</h2>
      </div>
    </div>
    <form @submit.prevent="submit">
      <label>
        联系人
        <input v-model.trim="form.name" type="text" placeholder="例如：张先生" maxlength="20" />
      </label>
      <div class="form-grid">
        <label>
          人数
          <input v-model.number="form.size" type="number" min="1" max="99" />
        </label>
        <label>
          到店时间
          <input v-model="form.arrivalTime" type="datetime-local" />
        </label>
      </div>
      <label class="check-line">
        <input v-model="form.acceptShare" type="checkbox" />
        接受与其他客人拼桌
      </label>
      <p v-if="submitted && store.error.value" class="inline-error">{{ store.error.value }}</p>
      <button class="primary" type="submit">加入候位</button>
    </form>
  </section>
</template>
