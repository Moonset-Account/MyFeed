import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from './backup';
import type { BackupData } from './backup';

const sample: BackupData = {
  plants: [
    {
      id: 'p1',
      name: '玉露',
      species: 'Haworthia',
      icon: '🌵',
      light: 'half-sun',
      waterIntervalDays: 12,
      fertilizeIntervalDays: null,
      createdAt: '2026-08-01'
    }
  ],
  events: [
    { id: 'e1', plantId: 'p1', type: 'water', date: '2026-09-25', note: '' },
    { id: 'e2', plantId: 'p1', type: 'repot', date: '2026-08-01', note: '换颗粒土' }
  ],
  postponements: [
    { id: 's1', plantId: 'p1', days: 2, reason: '连续阴雨', createdAt: '2026-09-27' }
  ]
};

describe('备份导出/导入', () => {
  it('导出后可完整恢复（往返一致）', () => {
    const text = serializeBackup(sample, new Date('2026-09-30T08:00:00Z'));
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(sample);
    }
  });

  it('拒绝非 JSON 内容', () => {
    const result = parseBackup('not json');
    expect(result.ok).toBe(false);
  });

  it('拒绝其他应用的文件', () => {
    const result = parseBackup(JSON.stringify({ app: 'other', version: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('备份文件');
  });

  it('拒绝字段缺失的植物数据', () => {
    const bad = {
      app: 'balcony-plant-calendar',
      version: 1,
      exportedAt: '2026-09-30T00:00:00Z',
      plants: [{ id: 'p1', name: '缺字段' }],
      events: [],
      postponements: []
    };
    const result = parseBackup(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });

  it('拒绝非法日期与非法养护类型', () => {
    const badEvent = {
      app: 'balcony-plant-calendar',
      version: 1,
      exportedAt: '2026-09-30T00:00:00Z',
      plants: sample.plants,
      events: [{ id: 'e', plantId: 'p1', type: 'spray', date: '2026/09/01', note: '' }],
      postponements: []
    };
    expect(parseBackup(JSON.stringify(badEvent)).ok).toBe(false);
  });
});
