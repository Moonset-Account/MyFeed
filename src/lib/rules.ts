import type { Area, Issue, Thresholds } from '../types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  minDoorWidth: 80,
  minPassageWidth: 90,
  maxStepHeight: 2,
};

export type MeasurementField = 'doorWidth' | 'passageWidth' | 'stepHeight';

export interface Violation {
  field: MeasurementField;
  label: string;
  actual: number;
  requirement: string;
}

/** 按阈值评估单个区域的测量值，返回不达标项；未填写的测量项跳过 */
export function evaluateArea(area: Area, thresholds: Thresholds): Violation[] {
  const violations: Violation[] = [];
  if (area.doorWidth !== null && area.doorWidth < thresholds.minDoorWidth) {
    violations.push({
      field: 'doorWidth',
      label: '门净宽',
      actual: area.doorWidth,
      requirement: `≥ ${thresholds.minDoorWidth} cm`,
    });
  }
  if (area.passageWidth !== null && area.passageWidth < thresholds.minPassageWidth) {
    violations.push({
      field: 'passageWidth',
      label: '通道净宽',
      actual: area.passageWidth,
      requirement: `≥ ${thresholds.minPassageWidth} cm`,
    });
  }
  if (area.stepHeight !== null && area.stepHeight > thresholds.maxStepHeight) {
    violations.push({
      field: 'stepHeight',
      label: '台阶/门槛高度',
      actual: area.stepHeight,
      requirement: `≤ ${thresholds.maxStepHeight} cm`,
    });
  }
  return violations;
}

export interface AreaSummary {
  area: Area;
  violations: Violation[];
  openIssues: Issue[];
  resolvedIssues: Issue[];
}

/** 按区域汇总：阈值不达标项 + 关联到该区域的问题（同一问题会出现在每个关联区域下） */
export function summarizeByArea(
  areas: Area[],
  issues: Issue[],
  thresholds: Thresholds,
): AreaSummary[] {
  return areas.map((area) => {
    const related = issues.filter((issue) => issue.areaIds.includes(area.id));
    return {
      area,
      violations: evaluateArea(area, thresholds),
      openIssues: related.filter((i) => i.status === 'open'),
      resolvedIssues: related.filter((i) => i.status === 'resolved'),
    };
  });
}

export interface OverallStats {
  totalAreas: number;
  areasWithViolations: number;
  totalViolations: number;
  openIssues: number;
  resolvedIssues: number;
}

export function overallStats(summaries: AreaSummary[]): OverallStats {
  const open = new Set<string>();
  const resolved = new Set<string>();
  let totalViolations = 0;
  let areasWithViolations = 0;
  for (const s of summaries) {
    totalViolations += s.violations.length;
    if (s.violations.length > 0) areasWithViolations += 1;
    s.openIssues.forEach((i) => open.add(i.id));
    s.resolvedIssues.forEach((i) => resolved.add(i.id));
  }
  return {
    totalAreas: summaries.length,
    areasWithViolations,
    totalViolations,
    openIssues: open.size,
    resolvedIssues: resolved.size,
  };
}
