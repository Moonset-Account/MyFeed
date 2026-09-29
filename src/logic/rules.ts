import type { Area, Issue, Measurement, Thresholds } from '../types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  doorWidthMin: 80,
  passageWidthMin: 90,
  stepHeightMax: 2,
};

export interface Violation {
  field: 'doorWidth' | 'passageWidth' | 'step';
  /** 例如 “门净宽 75cm < 标准 80cm” */
  message: string;
}

/** 根据阈值评估一组测量值，返回所有不达标项 */
export function evaluateMeasurement(m: Measurement, t: Thresholds): Violation[] {
  const violations: Violation[] = [];
  if (m.doorWidth !== null && m.doorWidth < t.doorWidthMin) {
    violations.push({
      field: 'doorWidth',
      message: `门净宽 ${m.doorWidth}cm 低于标准 ${t.doorWidthMin}cm`,
    });
  }
  if (m.passageWidth !== null && m.passageWidth < t.passageWidthMin) {
    violations.push({
      field: 'passageWidth',
      message: `通道净宽 ${m.passageWidth}cm 低于标准 ${t.passageWidthMin}cm`,
    });
  }
  if (m.hasStep && m.stepHeight > t.stepHeightMax) {
    violations.push({
      field: 'step',
      message: `台阶/门槛高 ${m.stepHeight}cm 超过限值 ${t.stepHeightMax}cm`,
    });
  }
  return violations;
}

export interface AreaSummary {
  area: Area;
  violations: Violation[];
  openIssues: Issue[];
  fixedIssues: Issue[];
}

/** 按区域汇总：测量达标情况 + 关联问题（同一问题可出现在多个区域） */
export function summarizeByArea(
  areas: Area[],
  issues: Issue[],
  thresholds: Thresholds,
): AreaSummary[] {
  return areas.map((area) => {
    const related = issues.filter((i) => i.areaIds.includes(area.id));
    return {
      area,
      violations: evaluateMeasurement(area.measurement, thresholds),
      openIssues: related.filter((i) => i.status === 'open'),
      fixedIssues: related.filter((i) => i.status === 'fixed'),
    };
  });
}

export interface OverallSummary {
  totalAreas: number;
  areasWithViolations: number;
  totalViolations: number;
  openIssues: number;
  fixedIssues: number;
}

export function summarizeOverall(summaries: AreaSummary[]): OverallSummary {
  // 问题按 id 去重，因为同一问题可关联多个区域
  const open = new Set<string>();
  const fixed = new Set<string>();
  for (const s of summaries) {
    s.openIssues.forEach((i) => open.add(i.id));
    s.fixedIssues.forEach((i) => fixed.add(i.id));
  }
  return {
    totalAreas: summaries.length,
    areasWithViolations: summaries.filter((s) => s.violations.length > 0).length,
    totalViolations: summaries.reduce((n, s) => n + s.violations.length, 0),
    openIssues: open.size,
    fixedIssues: fixed.size,
  };
}

/** 校验阈值配置，返回错误信息；空字符串表示合法 */
export function validateThresholds(t: Thresholds): string {
  const fields: Array<[keyof Thresholds, string]> = [
    ['doorWidthMin', '门净宽最小值'],
    ['passageWidthMin', '通道净宽最小值'],
    ['stepHeightMax', '台阶高度限值'],
  ];
  for (const [key, label] of fields) {
    const v = t[key];
    if (!Number.isFinite(v) || v < 0 || v > 500) {
      return `${label}需为 0–500 之间的数字`;
    }
  }
  return '';
}
