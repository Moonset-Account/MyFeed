import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  registerParty,
  suggestForType,
  callParty,
  seatParty,
  passParty,
  requeueParty,
  cancelParty,
  shareSeat,
  freeTable,
  waitingAhead,
  waitingList,
  availableCount,
  clearDay,
  type State
} from './core'

const T0 = new Date('2026-09-30T10:00:00').getTime()
const at = (min: number) => T0 + min * 60_000

function freshState(): State {
  return createInitialState(T0)
}

describe('登记取号', () => {
  it('按最小合适桌型分配号段并递增', () => {
    const s = freshState()
    const p1 = registerParty(s, 2, false, at(1))
    const p2 = registerParty(s, 3, false, at(2))
    const p3 = registerParty(s, 7, true, at(3))
    expect(p1.ticket).toBe('A001') // 小桌
    expect(p2.ticket).toBe('B001') // 中桌
    expect(p3.ticket).toBe('C001') // 大桌
    expect(registerParty(s, 2, false, at(4)).ticket).toBe('A002')
  })

  it('超出最大桌型时拒绝登记', () => {
    const s = freshState()
    expect(() => registerParty(s, 20, false, at(1))).toThrow(/桌型/)
  })

  it('登记会写记录', () => {
    const s = freshState()
    registerParty(s, 2, false, at(1))
    expect(s.logs.some((l) => l.type === 'register')).toBe(true)
  })
})

describe('叫号建议', () => {
  it('按合适桌型与排队顺序给出建议', () => {
    const s = freshState()
    registerParty(s, 2, false, at(1)) // A001
    registerParty(s, 4, false, at(2)) // B001
    registerParty(s, 2, false, at(3)) // A002
    // 中桌空出：建议 B001（最小合适桌型是中桌）
    expect(suggestForType(s, 't-mid')?.ticket).toBe('B001')
    // 小桌空出：建议 A001
    expect(suggestForType(s, 't-small')?.ticket).toBe('A001')
  })

  it('没有最佳匹配时退到能容纳的最早排队者', () => {
    const s = freshState()
    registerParty(s, 2, false, at(1)) // A001
    expect(suggestForType(s, 't-large')?.ticket).toBe('A001')
  })

  it('桌型无空桌时不给建议', () => {
    const s = freshState()
    s.tableTypes.find((t) => t.id === 't-small')!.total = 1
    const p = registerParty(s, 2, false, at(1))
    callParty(s, p.id, 't-small', at(2))
    registerParty(s, 2, false, at(3))
    expect(availableCount(s, 't-small')).toBe(0)
    expect(suggestForType(s, 't-small')).toBeNull()
  })
})

describe('过号 / 取消 / 重新排队', () => {
  it('过号留记录并可重新排队到队尾', () => {
    const s = freshState()
    const p1 = registerParty(s, 2, false, at(1))
    const p2 = registerParty(s, 2, false, at(2))
    callParty(s, p1.id, 't-small', at(3))
    passParty(s, p1.id, at(4))
    expect(p1.status).toBe('passed')
    expect(s.logs.some((l) => l.type === 'pass' && l.message.includes(p1.ticket))).toBe(true)
    requeueParty(s, p1.id, at(5))
    expect(waitingList(s).map((p) => p.ticket)).toEqual([p2.ticket, p1.ticket])
  })

  it('取消留记录', () => {
    const s = freshState()
    const p = registerParty(s, 3, false, at(1))
    cancelParty(s, p.id, at(2))
    expect(p.status).toBe('cancelled')
    expect(s.logs.some((l) => l.type === 'cancel')).toBe(true)
  })

  it('未叫号不能记过号', () => {
    const s = freshState()
    const p = registerParty(s, 2, false, at(1))
    expect(() => passParty(s, p.id, at(2))).toThrow()
  })
})

describe('拼桌', () => {
  it('拼桌入座留记录并共享桌实例', () => {
    const s = freshState()
    const p1 = registerParty(s, 2, true, at(1))
    const p2 = registerParty(s, 2, true, at(2))
    callParty(s, p1.id, 't-mid', at(3))
    callParty(s, p2.id, 't-mid', at(4))
    shareSeat(s, [p1.id, p2.id], 't-mid', at(5))
    expect(p1.status).toBe('seated')
    expect(p1.tableInstanceId).toBe(p2.tableInstanceId)
    expect(s.logs.some((l) => l.type === 'share')).toBe(true)
    // 两人拼一桌只占一个中桌
    expect(availableCount(s, 't-mid')).toBe(5)
  })

  it('合计人数超过座位数时拒绝拼桌', () => {
    const s = freshState()
    const p1 = registerParty(s, 4, true, at(1))
    const p2 = registerParty(s, 4, true, at(2))
    callParty(s, p1.id, 't-mid', at(3))
    callParty(s, p2.id, 't-mid', at(4))
    expect(() => shareSeat(s, [p1.id, p2.id], 't-mid', at(5))).toThrow(/超出/)
  })
})

describe('入座与空桌', () => {
  it('入座占用桌位，离店后释放', () => {
    const s = freshState()
    const p = registerParty(s, 2, false, at(1))
    callParty(s, p.id, 't-small', at(2))
    seatParty(s, p.id, at(3))
    expect(availableCount(s, 't-small')).toBe(3)
    expect(freeTable(s, 't-small', at(4))).toBe(true)
    expect(p.status).toBe('done')
    expect(availableCount(s, 't-small')).toBe(4)
  })
})

describe('预计等待', () => {
  it('统计同桌型前方等待组数', () => {
    const s = freshState()
    registerParty(s, 2, false, at(1))
    registerParty(s, 4, false, at(2)) // 中桌，不影响小桌队列
    const p3 = registerParty(s, 2, false, at(3))
    expect(waitingAhead(s, p3.id)).toBe(1)
  })
})

describe('清空当天数据', () => {
  it('清空候位与记录，保留桌型配置', () => {
    const s = freshState()
    registerParty(s, 2, false, at(1))
    registerParty(s, 4, false, at(2))
    clearDay(s, at(10))
    expect(s.parties).toHaveLength(0)
    expect(s.counters).toEqual({})
    expect(s.tableTypes.length).toBeGreaterThan(0)
    expect(s.logs.some((l) => l.type === 'clear')).toBe(true)
    // 清空后重新从 1 编号
    expect(registerParty(s, 2, false, at(11)).ticket).toBe('A001')
  })
})
