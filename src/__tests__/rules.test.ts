import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  evaluateMeasurement,
  summarizeByArea,
  summarizeOverall,
  validateThresholds,
} from '../logic/rules';
import type { Area, Issue, Measurement } from '../types';

const m = (over: Partial<Measurement>): Measurement => ({
  doorWidth: null,
  passageWidth: null,
  hasStep: false,
  stepHeight: 0,
  note: '',
  ...over,
});

const area = (id: string, measurement: Measurement): Area => ({ id, name: id, measurement });

const issue = (id: string, areaIds: string[], status: 'open' | 'fixed'): Issue => ({
  id,
  title: id,
  description: '',
  suggestion: '',
  areaIds,
  severity: 'medium',
  status,
  beforePhotos: [],
  afterPhotos: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  fixedAt: status === 'fixed' ? '2026-02-01T00:00:00.000Z' : null,
});

describe('evaluateMeasurement', () => {
  it('全部达标时无违规', () => {
    const v = evaluateMeasurement(
      m({ doorWidth: 85, passageWidth: 100, hasStep: true, stepHeight: 2 }),
      DEFAULT_THRESHOLDS,
    );
    expect(v).toHaveLength(0);
  });

  it('门宽、通道宽、台阶分别触发违规', () => {
    const v = evaluateMeasurement(
      m({ doorWidth: 70, passageWidth: 80, hasStep: true, stepHeight: 5 }),
      DEFAULT_THRESHOLDS,
    );
    expect(v.map((x) => x.field)).toEqual(['doorWidth', 'passageWidth', 'step']);
  });

  it('未测量（null）的字段不判定违规', () => {
    expect(evaluateMeasurement(m({}), DEFAULT_THRESHOLDS)).toHaveLength(0);
  });

  it('无台阶时忽略台阶高度', () => {
    const v = evaluateMeasurement(m({ hasStep: false, stepHeight: 10 }), DEFAULT_THRESHOLDS);
    expect(v).toHaveLength(0);
  });

  it('阈值可手动配置并生效', () => {
    const t = { doorWidthMin: 60, passageWidthMin: 70, stepHeightMax: 0 };
    expect(evaluateMeasurement(m({ doorWidth: 70, passageWidth: 80 }), t)).toHaveLength(0);
    const v = evaluateMeasurement(m({ hasStep: true, stepHeight: 1 }), t);
    expect(v).toHaveLength(1);
    expect(v[0].field).toBe('step');
  });
});

describe('summarizeByArea / summarizeOverall', () => {
  const areas = [
    area('玄关', m({ doorWidth: 75 })),
    area('卫生间', m({ hasStep: true, stepHeight: 6 })),
    area('卧室', m({ doorWidth: 90 })),
  ];

  it('同一问题关联多个区域时出现在各区域汇总中', () => {
    const issues = [issue('门槛过高', ['玄关', '卫生间'], 'open')];
    const s = summarizeByArea(areas, issues, DEFAULT_THRESHOLDS);
    expect(s[0].openIssues.map((i) => i.id)).toEqual(['门槛过高']);
    expect(s[1].openIssues.map((i) => i.id)).toEqual(['门槛过高']);
    expect(s[2].openIssues).toHaveLength(0);
  });

  it('整改完成的问题计入 fixedIssues，总体统计按问题去重', () => {
    const issues = [
      issue('门槛过高', ['玄关', '卫生间'], 'fixed'),
      issue('门太窄', ['玄关'], 'open'),
    ];
    const s = summarizeByArea(areas, issues, DEFAULT_THRESHOLDS);
    const overall = summarizeOverall(s);
    expect(overall.totalAreas).toBe(3);
    expect(overall.areasWithViolations).toBe(2);
    expect(overall.openIssues).toBe(1);
    expect(overall.fixedIssues).toBe(1);
    expect(s[0].fixedIssues).toHaveLength(1);
    expect(s[1].fixedIssues).toHaveLength(1);
  });
});

describe('validateThresholds', () => {
  it('接受合法配置', () => {
    expect(validateThresholds(DEFAULT_THRESHOLDS)).toBe('');
  });
  it('拒绝非法数值', () => {
    expect(validateThresholds({ ...DEFAULT_THRESHOLDS, doorWidthMin: -1 })).not.toBe('');
    expect(validateThresholds({ ...DEFAULT_THRESHOLDS, stepHeightMax: NaN })).not.toBe('');
    expect(validateThresholds({ ...DEFAULT_THRESHOLDS, passageWidthMin: 999 })).not.toBe('');
  });
});
