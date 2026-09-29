import { describe, expect, it } from 'vitest';
import type { AppData } from './types';
import { backupToJSON, createBackupFileName, parseBackup } from './backup';
import { addCareEvent, createEmptyData, postponeWatering, upsertPlant } from './care';

const validData: AppData = (() => {
  let data = upsertPlant(createEmptyData(), {
    id: 'plant-1',
    name: '龟背竹',
    species: '龟背竹',
    lightLocation: '半阴处',
    waterIntervalDays: 7,
    fertilizeIntervalDays: 30,
    notes: '不要暴晒',
    createdAt: '2026-01-01'
  });
  data = addCareEvent(data, { plantId: 'plant-1', taskType: 'water', date: '2026-01-01' });
  data = postponeWatering(data, { plantId: 'plant-1', days: 2, date: '2026-01-07' });
  return data;
})();

describe('植物记录备份', () => {
  it('可往返序列化完整植物记录', () => {
    const restored = parseBackup(JSON.parse(backupToJSON(validData)));
    expect(restored.plants).toEqual(validData.plants);
    expect(restored.records).toHaveLength(2);
    expect(restored.records[1]).toMatchObject({ kind: 'postponement', days: 2 });
  });

  it('拒绝错误版本和缺失列表', () => {
    expect(() => parseBackup({ ...validData, version: 2 })).toThrow('备份版本不受支持');
    expect(() => parseBackup({ version: 1, plants: [] })).toThrow('植物或养护记录列表');
  });

  it('拒绝无效植物与悬空养护记录', () => {
    const badPlant = backupToJSON({
      ...validData,
      plants: [{ ...validData.plants[0], waterIntervalDays: 0 }]
    });
    expect(() => parseBackup(JSON.parse(badPlant))).toThrow('浇水间隔');

    const danglingRecord = backupToJSON({
      ...validData,
      records: [{ ...validData.records[0], plantId: 'missing' }]
    });
    expect(() => parseBackup(JSON.parse(danglingRecord))).toThrow('不存在的植物');
  });

  it('拒绝把非浇水记录标为顺延', () => {
    const bad = backupToJSON({
      ...validData,
      records: [{ id: 'x', plantId: 'plant-1', kind: 'postponement', taskType: 'fertilize', date: '2026-01-02', days: 1 }] as any[]
    });
    expect(() => parseBackup(JSON.parse(bad))).toThrow('顺延记录只能用于浇水');
  });


  it('拒绝引用其他植物或非浇水事件的顺延结清记录', () => {
    const water = validData.records.find((record) => record.kind === 'care');
    const postponement = validData.records.find((record) => record.kind === 'postponement');
    if (!water || !postponement) throw new Error('测试数据缺失');
    const bad = backupToJSON({
      ...validData,
      records: validData.records.map((record) =>
        record.id === postponement.id ? { ...record, resolvedByEventId: water.id, date: '2026-01-08' } : record
      )
    });
    expect(() => parseBackup(JSON.parse(bad))).toThrow('早于顺延日期');
  });

  it('生成稳定的日期备份文件名', () => {
    expect(createBackupFileName(new Date('2026-09-30T08:00:00Z'))).toBe('plant-care-backup-2026-09-30.json');
  });
});
