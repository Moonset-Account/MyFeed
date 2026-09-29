import { computed, reactive, watch } from 'vue'
import type { RepairRecord, RepairStatus } from './types'
import { computeStats, createRecord, findByBookNo, recordInspection, transition } from './domain'
import type { NewRecordInput } from './types'

const STORAGE_KEY = 'book-repair-registry:v1'

function load(): RepairRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? (data as RepairRecord[]) : []
  } catch {
    return []
  }
}

const state = reactive({
  records: load() as RepairRecord[],
})

watch(
  () => state.records,
  (records) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  },
  { deep: true },
)

export function useStore() {
  function addRecord(input: NewRecordInput): RepairRecord {
    const record = createRecord(input)
    state.records.unshift(record)
    return record
  }

  function changeStatus(id: string, to: RepairStatus, operator: string, note?: string): void {
    const idx = state.records.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('记录不存在')
    state.records[idx] = transition(state.records[idx], to, operator, note)
  }

  function inspect(id: string, passed: boolean, note: string, inspector: string): void {
    const idx = state.records.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('记录不存在')
    state.records[idx] = recordInspection(state.records[idx], passed, note, inspector)
  }

  function remove(id: string): void {
    const idx = state.records.findIndex((r) => r.id === id)
    if (idx >= 0) state.records.splice(idx, 1)
  }

  function seedSample(): void {
    if (state.records.length > 0) return
    const now = Date.now()
    const samples: Array<[NewRecordInput, number]> = [
      [
        {
          bookNo: 'TP311.5-042',
          title: '重构：改善既有代码的设计',
          damageLocation: '书脊开裂，封面右上角磨损',
          photoNote: '照片1：书脊整体开裂；照片2：封面磨损特写',
          repairSteps: ['清理书脊残胶', '书脊重新上胶装订', '封面覆膜加固'],
          handler: '王敏',
        },
        now - 1000 * 60 * 60 * 24 * 2,
      ],
      [
        {
          bookNo: 'I242.4-017',
          title: '西游记（上）',
          damageLocation: '第 32-40 页脱页',
          photoNote: '照片1：脱页散落情况',
          repairSteps: ['页码排序核对', '脱页重新粘贴', '压平晾干'],
          handler: '李强',
        },
        now - 1000 * 60 * 60 * 5,
      ],
      [
        {
          bookNo: 'K248.07-003',
          title: '明朝那些事儿（叁）',
          damageLocation: '封底撕裂约 5cm',
          photoNote: '照片1：封底撕裂位置标注',
          repairSteps: ['撕裂处对齐', '无酸胶带修补'],
          handler: '王敏',
        },
        now - 1000 * 60 * 30,
      ],
    ]
    for (const [input, ts] of samples) {
      const record = createRecord(input, ts)
      state.records.unshift(record)
    }
  }

  const stats = computed(() => computeStats(state.records))

  return {
    records: state.records,
    stats,
    addRecord,
    changeStatus,
    inspect,
    remove,
    seedSample,
    findByBookNo: (bookNo: string) => findByBookNo(state.records, bookNo),
  }
}
