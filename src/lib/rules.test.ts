import { describe, expect, it } from 'vitest';
import type { Area, Issue } from '../types';
import { DEFAULT_THRESHOLDS, evaluateArea, overallStats, summarizeByArea } from './rules';

function makeArea(partial: Partial<Area>): Area {
  return {
    id: 'a1',
    name: '玄关',
    doorWidth: null,
    passageWidth: null,
    stepHeight: null,
    notes: '',
    ...partial,
  };
}

function makeIssue(partial: Partial<Issue>): Issue {
  return {
    id: 'i1',
    title: '门槛过高',
    description: '',
    areaIds: ['a1'],
    suggestion: '',
    status: 'open',
    beforePhotos: [],
    afterPhotos: [],
    createdAt: '2026-09-30T00:00:00.000Z',
    resolvedAt: null,
    ...partial,
  };
}

describe('evaluateArea', () => {
  it('测量值全部达标时不产生违规项', () => {
    const area = makeArea({ doorWidth: 85, passageWidth: 100, stepHeight: 0 });
    expect(evaluateArea(area, DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('门宽、通道低于下限、台阶高于上限时分别产生违规项', () => {
    const area = makeArea({ doorWidth: 70, passageWidth: 80, stepHeight: 5 });
    const violations = evaluateArea(area, DEFAULT_THRESHOLDS);
    expect(violations.map((v) => v.field)).toEqual(['doorWidth', 'passageWidth', 'stepHeight']);
  });

  it('边界值视为达标', () => {
    const area = makeArea({ doorWidth: 80, passageWidth: 90, stepHeight: 2 });
    expect(evaluateArea(area, DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('未填写的测量项跳过评估', () => {
    const area = makeArea({ doorWidth: null, passageWidth: null, stepHeight: null });
    expect(evaluateArea(area, DEFAULT_THRESHOLDS)).toEqual([]);
  });

  it('阈值可手动配置并即时生效', () => {
    const area = makeArea({ doorWidth: 75 });
    expect(evaluateArea(area, DEFAULT_THRESHOLDS)).toHaveLength(1);
    expect(evaluateArea(area, { ...DEFAULT_THRESHOLDS, minDoorWidth: 70 })).toHaveLength(0);
  });
});

describe('summarizeByArea', () => {
  const areas = [makeArea({ id: 'a1', name: '玄关', stepHeight: 6 }), makeArea({ id: 'a2', name: '卧室' })];

  it('同一问题关联多个区域时出现在每个区域的汇总中', () => {
    const issues = [makeIssue({ id: 'i1', areaIds: ['a1', 'a2'] })];
    const summaries = summarizeByArea(areas, issues, DEFAULT_THRESHOLDS);
    expect(summaries[0].openIssues.map((i) => i.id)).toEqual(['i1']);
    expect(summaries[1].openIssues.map((i) => i.id)).toEqual(['i1']);
  });

  it('按状态区分待整改与已整改，已整改保留前后记录', () => {
    const issues = [
      makeIssue({ id: 'i1', status: 'open' }),
      makeIssue({
        id: 'i2',
        status: 'resolved',
        resolvedAt: '2026-09-29T00:00:00.000Z',
        beforePhotos: [{ id: 'p1', dataUrl: 'data:', caption: '' }],
        afterPhotos: [{ id: 'p2', dataUrl: 'data:', caption: '' }],
      }),
    ];
    const [summary] = summarizeByArea([areas[0]], issues, DEFAULT_THRESHOLDS);
    expect(summary.openIssues.map((i) => i.id)).toEqual(['i1']);
    expect(summary.resolvedIssues.map((i) => i.id)).toEqual(['i2']);
    expect(summary.resolvedIssues[0].beforePhotos).toHaveLength(1);
    expect(summary.resolvedIssues[0].afterPhotos).toHaveLength(1);
  });

  it('汇总包含各区域的测量违规项', () => {
    const summaries = summarizeByArea(areas, [], DEFAULT_THRESHOLDS);
    expect(summaries[0].violations.map((v) => v.field)).toEqual(['stepHeight']);
    expect(summaries[1].violations).toEqual([]);
  });
});

describe('overallStats', () => {
  it('跨区域关联的同一问题在总计中只计一次', () => {
    const areas = [makeArea({ id: 'a1' }), makeArea({ id: 'a2', name: '卧室' })];
    const issues = [
      makeIssue({ id: 'i1', areaIds: ['a1', 'a2'] }),
      makeIssue({ id: 'i2', status: 'resolved', areaIds: ['a1'] }),
    ];
    const stats = overallStats(summarizeByArea(areas, issues, DEFAULT_THRESHOLDS));
    expect(stats.totalAreas).toBe(2);
    expect(stats.openIssues).toBe(1);
    expect(stats.resolvedIssues).toBe(1);
  });
});
