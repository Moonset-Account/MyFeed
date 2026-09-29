import { describe, it, expect } from 'vitest'
import { canGenerateFinal, compareInspections, inspectionMissing } from '../logic'
import { createDefaultProject } from '../store'
import type { Project } from '../types'

function fillProject(p: Project): void {
  for (const inspection of [p.checkIn, p.checkOut]) {
    inspection.date = '2026-09-01'
    for (const room of p.rooms) {
      const rec = inspection.rooms[room.id]
      rec.keys = 2
      rec.waterReading = 100
      rec.electricityReading = 200
      for (const item of room.items) {
        rec.items[item.id].status = 'good'
      }
    }
  }
  p.signatures.landlord = '张三'
  p.signatures.tenant = '李四'
}

describe('canGenerateFinal', () => {
  it('默认模板缺项时禁止生成完成版交接单', () => {
    const p = createDefaultProject()
    const result = canGenerateFinal(p)
    expect(result.ok).toBe(false)
    expect(result.missing.length).toBeGreaterThan(0)
  })

  it('两次检查与签字齐备后允许生成', () => {
    const p = createDefaultProject()
    fillProject(p)
    expect(canGenerateFinal(p).ok).toBe(true)
  })

  it('任一设施状态未填写都会阻止生成', () => {
    const p = createDefaultProject()
    fillProject(p)
    const room = p.rooms[0]
    p.checkOut.rooms[room.id].items[room.items[0].id].status = ''
    const result = canGenerateFinal(p)
    expect(result.ok).toBe(false)
    expect(result.missing.some((m) => m.includes('退租检查'))).toBe(true)
  })

  it('缺少签字姓名会阻止生成', () => {
    const p = createDefaultProject()
    fillProject(p)
    p.signatures.tenant = '  '
    const result = canGenerateFinal(p)
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('租客签字姓名未录入')
  })

  it('缺少钥匙数量或表读数会阻止生成', () => {
    const p = createDefaultProject()
    fillProject(p)
    const room = p.rooms[1]
    p.checkIn.rooms[room.id].keys = null
    p.checkIn.rooms[room.id].waterReading = null
    const result = canGenerateFinal(p)
    expect(result.ok).toBe(false)
    expect(result.missing.some((m) => m.includes('钥匙数量'))).toBe(true)
    expect(result.missing.some((m) => m.includes('水表读数'))).toBe(true)
  })
})

describe('inspectionMissing', () => {
  it('列出每个房间的全部缺项', () => {
    const p = createDefaultProject()
    const missing = inspectionMissing(p.rooms, p.checkIn)
    // 每个房间：钥匙 + 水表 + 电表 + 全部设施
    const perRoom = 3 + p.rooms[0].items.length
    expect(missing.length).toBeGreaterThanOrEqual(perRoom)
  })
})

describe('compareInspections', () => {
  it('计算水电用量与钥匙差值', () => {
    const p = createDefaultProject()
    fillProject(p)
    const room = p.rooms[0]
    p.checkOut.rooms[room.id].waterReading = 135.5
    p.checkOut.rooms[room.id].electricityReading = 260
    p.checkOut.rooms[room.id].keys = 1
    const [cmp] = compareInspections(p)
    expect(cmp.waterUsage).toBe(35.5)
    expect(cmp.electricityUsage).toBe(60)
    expect(cmp.keysDiff).toBe(-1)
  })

  it('标记状态发生变化的设施', () => {
    const p = createDefaultProject()
    fillProject(p)
    const room = p.rooms[0]
    const item = room.items[0]
    p.checkOut.rooms[room.id].items[item.id].status = 'damaged'
    const [cmp] = compareInspections(p)
    const changed = cmp.items.find((i) => i.itemId === item.id)
    expect(changed?.changed).toBe(true)
    const unchanged = cmp.items.filter((i) => i.itemId !== item.id)
    expect(unchanged.every((i) => !i.changed)).toBe(true)
  })

  it('读数缺失时用量为 null', () => {
    const p = createDefaultProject()
    fillProject(p)
    p.checkOut.rooms[p.rooms[0].id].waterReading = null
    const [cmp] = compareInspections(p)
    expect(cmp.waterUsage).toBeNull()
  })
})
