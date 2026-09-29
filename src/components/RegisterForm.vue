<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useStore } from '../store'

const emit = defineEmits<{ registered: [] }>()
const store = useStore()

const form = reactive({
  bookNo: '',
  title: '',
  damageLocation: '',
  photoNote: '',
  repairStepsText: '',
  handler: '',
})

const error = ref('')
const justSaved = ref(false)

function submit() {
  error.value = ''
  try {
    store.addRecord({
      bookNo: form.bookNo,
      title: form.title,
      damageLocation: form.damageLocation,
      photoNote: form.photoNote,
      repairSteps: form.repairStepsText.split('\n'),
      handler: form.handler,
    })
    justSaved.value = true
    setTimeout(() => emit('registered'), 600)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <section>
    <h2>破损登记</h2>
    <p class="hint">按书号登记破损情况，登记后进入「待评估」状态。</p>
    <form class="form" @submit.prevent="submit">
      <label>
        书号 <span class="req">*</span>
        <input v-model="form.bookNo" placeholder="如 TP311.5-042" required />
      </label>
      <label>
        书名
        <input v-model="form.title" placeholder="可选" />
      </label>
      <label>
        破损位置 <span class="req">*</span>
        <input v-model="form.damageLocation" placeholder="如 书脊开裂、第 32 页脱页" required />
      </label>
      <label>
        照片说明
        <textarea v-model="form.photoNote" rows="2" placeholder="描述已拍摄照片的内容与编号"></textarea>
      </label>
      <label>
        修补步骤 <span class="req">*</span>（每行一步）
        <textarea v-model="form.repairStepsText" rows="4" placeholder="清理书脊残胶&#10;重新上胶装订&#10;压平晾干" required></textarea>
      </label>
      <label>
        处理人 <span class="req">*</span>
        <input v-model="form.handler" placeholder="登记人姓名" required />
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="justSaved" class="success">已登记，正在跳转到登记册…</p>
      <button type="submit" class="primary">登记</button>
    </form>
  </section>
</template>
