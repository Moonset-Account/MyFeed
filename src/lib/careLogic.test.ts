import { describe, expect, it } from 'vitest';
import {
  buildCompletion,
  incompleteInstances,
  instancesForDate,
  isCompleted,
  recordsForInstance,
  recordsToCSV,
  recordsToJSON,
  shiftDateKey,
  sortRecordsDesc,
  toDateKey
} from './careLogic';
import { SAMPLE_PETS, SAMPLE_TEMPLATES, seedRecords } from './sampleData';
import type { TaskInstance } from './types';

const DATE = '2026-09-30';

function firstInstance(): TaskInstance {
  return instancesForDate(SAMPLE_TEMPLATES, DATE)[0];
}

describe('日期工具', () => {
  it('toDateKey 输出 YYYY-MM-DD 并补零', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 8, 30))).toBe('2026-09-30');
  });

  it('shiftDateKey 跨月加减正确', () => {
    expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('事项实例生成', () => {
  it('每个模板每天生成一个实例，instanceId 含日期', () => {
    const instances = instancesForDate(SAMPLE_TEMPLATES, DATE);
    expect(instances).toHaveLength(SAMPLE_TEMPLATES.length);
    expect(instances[0].instanceId).toBe(`${SAMPLE_TEMPLATES[0].id}@${DATE}`);
  });

  it('实例按计划时间升序排列', () => {
    const instances = instancesForDate(SAMPLE_TEMPLATES, DATE);
    const times = instances.map((i) => i.time);
    expect(times).toEqual([...times].sort());
  });

  it('不同日期的实例互不影响', () => {
    const a = instancesForDate(SAMPLE_TEMPLATES, DATE);
    const b = instancesForDate(SAMPLE_TEMPLATES, shiftDateKey(DATE, 1));
    expect(a[0].instanceId).not.toBe(b[0].instanceId);
  });
});

describe('完成与重复确认', () => {
  it('首次确认不标记重复，再次确认标记 duplicate', () => {
    const inst = firstInstance();
    const first = buildCompletion(inst, '布丁', '小林', '', [], new Date('2026-09-30T08:00:00'));
    expect(first.duplicate).toBe(false);

    const second = buildCompletion(inst, '布丁', '阿梅', '又喂了一次', [first], new Date('2026-09-30T09:00:00'));
    expect(second.duplicate).toBe(true);
  });

  it('isCompleted 只认同一 instanceId 的记录', () => {
    const inst = firstInstance();
    const rec = buildCompletion(inst, '布丁', '小林', '', []);
    expect(isCompleted([rec], inst.instanceId)).toBe(true);
    expect(isCompleted([rec], 'other@2026-09-30')).toBe(false);
  });

  it('incompleteInstances 过滤掉已完成事项', () => {
    const instances = instancesForDate(SAMPLE_TEMPLATES, DATE);
    const rec = buildCompletion(instances[0], '可乐', '老周', '', []);
    const rest = incompleteInstances(instances, [rec]);
    expect(rest).toHaveLength(instances.length - 1);
    expect(rest.find((i) => i.instanceId === instances[0].instanceId)).toBeUndefined();
  });

  it('recordsForInstance 按完成时间升序返回该事项的全部记录', () => {
    const inst = firstInstance();
    const later = buildCompletion(inst, '布丁', '阿梅', '', [], new Date('2026-09-30T10:00:00'));
    const earlier = buildCompletion(inst, '布丁', '小林', '', [later], new Date('2026-09-30T08:00:00'));
    const list = recordsForInstance([later, earlier], inst.instanceId);
    expect(list.map((r) => r.completedBy)).toEqual(['小林', '阿梅']);
  });
});

describe('交接记录导出', () => {
  it('CSV 含表头、BOM，且按完成时间倒序', () => {
    const inst = firstInstance();
    const r1 = buildCompletion(inst, '布丁', '小林', '正常', [], new Date('2026-09-30T08:00:00'));
    const r2 = buildCompletion(inst, '布丁', '阿梅', '备注,带逗号', [r1], new Date('2026-09-30T09:00:00'));
    const csv = recordsToCSV([r1, r2]);
    const lines = csv.split('\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toContain('日期,事项,宠物,完成时间,执行人,备注,重复确认');
    expect(lines[1]).toContain('阿梅');
    expect(lines[1]).toContain('"备注,带逗号"');
    expect(lines[2]).toContain('小林');
    expect(lines[1]).toContain('是');
    expect(lines[2]).toContain('否');
  });

  it('JSON 导出为可解析的倒序数组', () => {
    const inst = firstInstance();
    const r1 = buildCompletion(inst, '布丁', '小林', '', [], new Date('2026-09-30T08:00:00'));
    const r2 = buildCompletion(inst, '布丁', '阿梅', '', [r1], new Date('2026-09-30T09:00:00'));
    const parsed = JSON.parse(recordsToJSON([r1, r2]));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].completedBy).toBe('阿梅');
  });

  it('sortRecordsDesc 不修改原数组', () => {
    const inst = firstInstance();
    const r1 = buildCompletion(inst, '布丁', '小林', '', [], new Date('2026-09-30T08:00:00'));
    const r2 = buildCompletion(inst, '布丁', '阿梅', '', [r1], new Date('2026-09-30T09:00:00'));
    const input = [r1, r2];
    sortRecordsDesc(input);
    expect(input[0]).toBe(r1);
  });
});

describe('示例数据', () => {
  it('模板引用的宠物都存在', () => {
    const petIds = new Set(SAMPLE_PETS.map((p) => p.id));
    for (const t of SAMPLE_TEMPLATES) {
      expect(petIds.has(t.petId)).toBe(true);
    }
  });

  it('种子记录包含一条重复确认示例，且 instanceId 与日期一致', () => {
    const records = seedRecords(new Date('2026-09-30T12:00:00'));
    expect(records.some((r) => r.duplicate)).toBe(true);
    for (const r of records) {
      expect(r.instanceId.endsWith(`@${r.date}`)).toBe(true);
    }
  });
});
