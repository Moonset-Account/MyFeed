import { describe, it, expect } from 'vitest'
import {
  defaultProject,
  ensureFacilityRecord,
  ensureRoomRecord,
  findMissingItems,
  isInspectionComplete,
  compareInspections,
  canGenerateFinal,
  exportProject,
  importProject,
  type Project,
} from '../inspection'

function fillComplete(project: Project, kind: 'checkin' | 'checkout') {
  const insp = project[kind]
  insp.date = '2026-09-01'
  insp.landlordName = '张三'
  insp.tenantName = '李四'
  for (const room of project.rooms) {
    const rec = ensureRoomRecord(insp, room.id)
    rec.keyCount = 2
    rec.waterMeter = 100
    rec.electricMeter = 200
    for (const f of room.facilities) {
      ensureFacilityRecord(insp, room.id, f.id).status = 'good'
    }
  }
}

describe('完整性校验', () => {
  it('空数据缺基本信息与所有房间项', () => {
    const p = defaultProject()
    const missing = findMissingItems(p.checkin, p.rooms)
    expect(missing.some((m) => m.roomName === '基本信息' && m.field === '检查日期')).toBe(true)
    expect(missing.some((m) => m.field === '整个房间未填写')).toBe(true)
    expect(isInspectionComplete(p.checkin, p.rooms)).toBe(false)
  })

  it('填写完整后无缺项', () => {
    const p = defaultProject()
    fillComplete(p, 'checkin')
    expect(findMissingItems(p.checkin, p.rooms)).toEqual([])
    expect(isInspectionComplete(p.checkin, p.rooms)).toBe(true)
  })

  it('缺少单个设施状态或签字时判定不完整', () => {
    const p = defaultProject()
    fillComplete(p, 'checkin')
    const room = p.rooms[0]
    ensureFacilityRecord(p.checkin, room.id, room.facilities[0].id).status = ''
    expect(isInspectionComplete(p.checkin, p.rooms)).toBe(false)

    ensureFacilityRecord(p.checkin, room.id, room.facilities[0].id).status = 'good'
    p.checkin.tenantName = '  '
    expect(isInspectionComplete(p.checkin, p.rooms)).toBe(false)
  })

  it('水电表读数与钥匙数量为必填', () => {
    const p = defaultProject()
    fillComplete(p, 'checkin')
    const rec = ensureRoomRecord(p.checkin, p.rooms[0].id)
    rec.waterMeter = null
    rec.keyCount = null
    const fields = findMissingItems(p.checkin, p.rooms).map((m) => m.field)
    expect(fields).toContain('水表读数')
    expect(fields).toContain('钥匙数量')
  })
})

describe('完成版交接单生成门槛', () => {
  it('任一次检查有缺项时禁止生成', () => {
    const p = defaultProject()
    fillComplete(p, 'checkin')
    expect(canGenerateFinal(p)).toBe(false)
    fillComplete(p, 'checkout')
    expect(canGenerateFinal(p)).toBe(true)
  })
})

describe('入住/退租逐项对比', () => {
  it('标记状态变化与读数差异', () => {
    const p = defaultProject()
    fillComplete(p, 'checkin')
    fillComplete(p, 'checkout')
    const room = p.rooms[0]
    const fac = room.facilities[0]
    ensureFacilityRecord(p.checkout, room.id, fac.id).status = 'damaged'
    ensureRoomRecord(p.checkout, room.id).electricMeter = 260

    const rows = compareInspections(p)
    const facRow = rows.find((r) => r.roomName === room.name && r.item.includes(fac.name))!
    expect(facRow.changed).toBe(true)
    expect(facRow.checkinValue).toBe('完好')
    expect(facRow.checkoutValue).toBe('损坏')

    const meterRow = rows.find((r) => r.roomName === room.name && r.item === '电表读数')!
    expect(meterRow.changed).toBe(true)
    expect(meterRow.checkoutValue).toBe('260 度')

    const unchanged = rows.filter((r) => !r.changed)
    expect(unchanged.length).toBeGreaterThan(0)
  })
})

describe('本地 JSON 备份', () => {
  it('导出后可无损导入', () => {
    const p = defaultProject()
    p.address = '幸福小区 1 栋 101'
    fillComplete(p, 'checkin')
    const restored = importProject(exportProject(p))
    expect(restored.address).toBe('幸福小区 1 栋 101')
    expect(restored.rooms.length).toBe(p.rooms.length)
    expect(isInspectionComplete(restored.checkin, restored.rooms)).toBe(true)
  })

  it('拒绝非法备份内容', () => {
    expect(() => importProject('not json')).toThrow()
    expect(() => importProject('{"app":"other"}')).toThrow()
    expect(() => importProject('{"project":{"rooms":[]}}')).toThrow()
  })
})
