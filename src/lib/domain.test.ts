import { describe, expect, it } from 'vitest';
import {
  canTransition,
  checkDistribute,
  daysToExpiry,
  distributedOf,
  expiryLevel,
  makeBatchNo,
  remainingOf,
  sortByExpiryPriority,
  toCsv,
  txnsToCsv,
  validateInbound,
  type Batch,
  type InboundInput,
  type Txn,
} from './domain';

const batch = (over: Partial<Batch> = {}): Batch => ({
  id: 'b1',
  batchNo: 'PC20260930-01',
  name: '矿泉水',
  category: '饮用水',
  quantity: 100,
  unit: '瓶',
  expiryDate: '2026-10-15',
  location: 'A区-01架',
  status: 'available',
  donor: '爱心企业',
  receivedAt: '2026-09-30T08:00:00.000Z',
  note: '',
  ...over,
});

const outbound = (batchId: string, quantity: number): Txn => ({
  id: `t-${batchId}-${quantity}-${Math.random()}`,
  type: 'outbound',
  batchId,
  batchNo: 'PC20260930-01',
  name: '矿泉水',
  quantity,
  operator: '志愿者甲',
  at: '2026-09-30T09:00:00.000Z',
  note: '',
});

describe('库存计算', () => {
  it('剩余库存 = 入库数 - 累计发放数', () => {
    const txns = [outbound('b1', 30), outbound('b1', 20), outbound('b2', 999)];
    expect(distributedOf('b1', txns)).toBe(50);
    expect(remainingOf(batch(), txns)).toBe(50);
  });

  it('无发放记录时剩余等于入库数', () => {
    expect(remainingOf(batch(), [])).toBe(100);
  });
});

describe('发放校验', () => {
  it('发放数量不得超过剩余库存', () => {
    const txns = [outbound('b1', 90)];
    const res = checkDistribute(batch(), txns, 11);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('超过剩余库存');
  });

  it('恰好发完剩余库存是允许的', () => {
    const txns = [outbound('b1', 90)];
    expect(checkDistribute(batch(), txns, 10).ok).toBe(true);
  });

  it('待检查与不合格批次不可发放', () => {
    expect(checkDistribute(batch({ status: 'pending' }), [], 1).ok).toBe(false);
    expect(checkDistribute(batch({ status: 'rejected' }), [], 1).ok).toBe(false);
  });

  it('发放数量必须为正整数', () => {
    expect(checkDistribute(batch(), [], 0).ok).toBe(false);
    expect(checkDistribute(batch(), [], -5).ok).toBe(false);
    expect(checkDistribute(batch(), [], 1.5).ok).toBe(false);
  });
});

describe('有效期与临期提示', () => {
  const today = '2026-09-30';

  it('计算距到期天数，过期为负', () => {
    expect(daysToExpiry(batch({ expiryDate: '2026-10-10' }), today)).toBe(10);
    expect(daysToExpiry(batch({ expiryDate: '2026-09-01' }), today)).toBe(-29);
    expect(daysToExpiry(batch({ expiryDate: '' }), today)).toBeNull();
  });

  it('临期分级：过期 / 临期 / 正常 / 无有效期', () => {
    expect(expiryLevel(batch({ expiryDate: '2026-09-01' }), today)).toBe('expired');
    expect(expiryLevel(batch({ expiryDate: '2026-10-30' }), today)).toBe('near');
    expect(expiryLevel(batch({ expiryDate: '2027-09-30' }), today)).toBe('safe');
    expect(expiryLevel(batch({ expiryDate: '' }), today)).toBe('none');
  });

  it('发放优先提示按剩余天数升序，无有效期排最后', () => {
    const sorted = sortByExpiryPriority(
      [
        batch({ id: 'a', expiryDate: '' }),
        batch({ id: 'b', expiryDate: '2027-01-01' }),
        batch({ id: 'c', expiryDate: '2026-10-05' }),
        batch({ id: 'd', expiryDate: '2026-09-01' }),
      ],
      today,
    );
    expect(sorted.map((b) => b.id)).toEqual(['d', 'c', 'b', 'a']);
  });
});

describe('入库登记校验', () => {
  const valid: InboundInput = {
    name: '方便面',
    category: '食品',
    quantity: 50,
    unit: '箱',
    expiryDate: '2027-03-01',
    location: 'B区-02架',
    status: 'pending',
    donor: '社区捐赠',
    note: '',
  };

  it('合法输入通过校验', () => {
    expect(validateInbound(valid)).toBeNull();
  });

  it('缺名称 / 数量非法 / 缺位置被拦截', () => {
    expect(validateInbound({ ...valid, name: ' ' })).toContain('物资名称');
    expect(validateInbound({ ...valid, quantity: 0 })).toContain('正整数');
    expect(validateInbound({ ...valid, quantity: 2.5 })).toContain('正整数');
    expect(validateInbound({ ...valid, location: '' })).toContain('存放位置');
  });

  it('有效期可留空，但填写时必须合法', () => {
    expect(validateInbound({ ...valid, expiryDate: '' })).toBeNull();
    expect(validateInbound({ ...valid, expiryDate: 'not-a-date' })).toContain('有效期');
  });
});

describe('批次号生成', () => {
  it('同日递增序号，不受其他日期影响', () => {
    const existing = [
      batch({ batchNo: 'PC20260930-01' }),
      batch({ batchNo: 'PC20260930-02' }),
      batch({ batchNo: 'PC20260929-09' }),
    ];
    expect(makeBatchNo(existing, '2026-09-30')).toBe('PC20260930-03');
    expect(makeBatchNo(existing, '2026-10-01')).toBe('PC20261001-01');
  });
});

describe('质检状态流转', () => {
  it('仅待检查可流转为可发放或不合格', () => {
    expect(canTransition('pending', 'available')).toBe(true);
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(canTransition('available', 'rejected')).toBe(false);
    expect(canTransition('rejected', 'available')).toBe(false);
    expect(canTransition('pending', 'pending')).toBe(false);
  });
});

describe('CSV 导出', () => {
  it('包含 BOM 且转义逗号、引号与换行', () => {
    const csv = toCsv(['名称', '备注'], [['矿泉水', '含,逗号'], ['"特"殊', '换\n行']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"含,逗号"');
    expect(csv).toContain('"""特""殊"');
    expect(csv).toContain('"换\n行"');
  });

  it('收发记录导出含表头与数据行', () => {
    const csv = txnsToCsv([outbound('b1', 5)]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('批次号');
    expect(lines[1]).toContain('发放');
    expect(lines[1]).toContain('PC20260930-01');
  });
});
