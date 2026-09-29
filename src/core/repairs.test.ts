import { describe, expect, it } from 'vitest';
import {
  advanceStatus,
  canBorrow,
  completeInspection,
  createEmptyChecklist,
  createRepairRecord,
  findRecordsByBookNumber,
  getTodoStats,
  recordsToCsv,
} from './repairs';

const baseInput = {
  bookNumber: ' b-001 ',
  damageLocation: '第 12 页撕裂',
  photoNote: '近景照片显示书页中缝开裂',
  repairSteps: ['清洁裂口', '用透明装订胶带固定'],
  handler: '王师傅',
};

function makeRecord(overrides = {}) {
  return createRepairRecord({ ...baseInput, ...overrides }, 'record-1', '2026-09-30T09:00:00.000Z');
}

describe('图书修补登记', () => {
  it('创建记录时规范化书号和修补步骤，并默认进入待评估', () => {
    const record = makeRecord({ repairSteps: ['清洁裂口', '', ' 用透明装订胶带固定 '] });

    expect(record.bookNumber).toBe('B-001');
    expect(record.status).toBe('pending_evaluation');
    expect(record.repairSteps).toEqual(['清洁裂口', '用透明装订胶带固定']);
    expect(canBorrow(record)).toBe(false);
  });

  it.each([
    { bookNumber: ' ', message: '请填写书号' },
    { damageLocation: ' ', message: '请填写破损位置' },
    { photoNote: ' ', message: '请填写照片说明' },
    { handler: ' ', message: '请填写处理人' },
    { repairSteps: [' '], message: '请至少填写一条修补步骤' },
  ])('校验必填字段：$message', (override) => {
    expect(() => makeRecord(override)).toThrow(override.message);
  });

  it('按待评估、修补中、待上架顺序流转', () => {
    let record = makeRecord();
    record = advanceStatus(record, '2026-09-30T10:00:00.000Z');
    expect(record.status).toBe('repairing');

    record = advanceStatus(record, '2026-09-30T11:00:00.000Z');
    expect(record.status).toBe('pending_shelving');
    expect(canBorrow(record)).toBe(false);

    expect(() => advanceStatus(record, '2026-09-30T12:00:00.000Z')).toThrow('当前状态不能继续流转');
  });

  it('待上架图书完成全部检查项并登记检查人后才可借', () => {
    let record = makeRecord();
    record = advanceStatus(record, '2026-09-30T10:00:00.000Z');
    record = advanceStatus(record, '2026-09-30T11:00:00.000Z');

    const checklist = createEmptyChecklist();
    expect(() => completeInspection(record, { inspector: '李馆员', checklist }, '2026-09-30T12:00:00.000Z'))
      .toThrow('请完成全部检查项');

    Object.keys(checklist).forEach((key) => {
      checklist[key as keyof typeof checklist] = true;
    });

    expect(() => completeInspection(record, { inspector: ' ', checklist }, '2026-09-30T12:00:00.000Z'))
      .toThrow('请填写检查人');

    record = completeInspection(record, { inspector: '李馆员', checklist }, '2026-09-30T12:00:00.000Z');
    expect(canBorrow(record)).toBe(true);
    expect(record.inspection?.inspector).toBe('李馆员');
  });

  it('按书号查询历史并统计待办', () => {
    const first = makeRecord();
    const second = createRepairRecord(
      { ...baseInput, bookNumber: 'B-001', repairSteps: ['复检书脊'] },
      'record-2',
      '2026-09-30T12:00:00.000Z',
    );
    const other = createRepairRecord(
      { ...baseInput, bookNumber: 'C-100', repairSteps: ['更换封皮'] },
      'record-3',
      '2026-09-30T08:00:00.000Z',
    );

    const history = findRecordsByBookNumber([first, second, other], 'b-001');
    expect(history.map((record) => record.id)).toEqual(['record-2', 'record-1']);

    const repairing = advanceStatus(other, '2026-09-30T09:00:00.000Z');
    let ready = advanceStatus(second, '2026-09-30T13:00:00.000Z');
    ready = advanceStatus(ready, '2026-09-30T14:00:00.000Z');
    const checklist = createEmptyChecklist();
    Object.keys(checklist).forEach((key) => {
      checklist[key as keyof typeof checklist] = true;
    });
    ready = completeInspection(ready, { inspector: '李馆员', checklist }, '2026-09-30T15:00:00.000Z');

    const stats = getTodoStats([first, repairing, ready]);
    expect(stats).toMatchObject({
      total: 3,
      pendingEvaluation: 1,
      repairing: 1,
      pendingShelving: 1,
      awaitingInspection: 0,
      available: 1,
      todo: 2,
    });
  });

  it('导出 CSV 时转义换行、引号并处理公式注入风险', () => {
    const record = makeRecord({
      bookNumber: '=1+1',
      photoNote: '照片"特写"\n第二行',
    });

    const csv = recordsToCsv([record]);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"照片""特写""\n第二行"');
    expect(csv).toContain('"否"');
  });
});
