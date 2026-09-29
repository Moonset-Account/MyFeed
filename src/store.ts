import { reactive, watch } from 'vue'
import {
  defaultProject,
  exportProject,
  importProject,
  type Project,
} from './logic/inspection'

const STORAGE_KEY = 'rental-inspection-project-v1'

function load(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return importProject(raw)
  } catch {
    // 本地缓存损坏时回退到默认数据
  }
  return defaultProject()
}

export const project = reactive<Project>(load())

watch(
  project,
  (p) => {
    try {
      localStorage.setItem(STORAGE_KEY, exportProject(p))
    } catch {
      // 存储空间不足等异常不影响使用
    }
  },
  { deep: true },
)

export function exportToFile() {
  const blob = new Blob([exportProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `出租房交接检查表-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importFromFile(file: File): Promise<void> {
  const text = await file.text()
  const restored = importProject(text)
  project.address = restored.address
  project.rooms = restored.rooms
  project.checkin = restored.checkin
  project.checkout = restored.checkout
}
