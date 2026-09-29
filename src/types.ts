/** 规则阈值，可在设置页手动配置，单位均为厘米 */
export interface Thresholds {
  /** 门净宽最小值 */
  doorWidthMin: number;
  /** 通道净宽最小值 */
  passageWidthMin: number;
  /** 允许的最大台阶/门槛高度（0 表示要求无高差） */
  stepHeightMax: number;
}

export interface Measurement {
  /** 门净宽（cm），未测量为 null */
  doorWidth: number | null;
  /** 通道净宽（cm），未测量为 null */
  passageWidth: number | null;
  /** 是否存在台阶/门槛 */
  hasStep: boolean;
  /** 台阶/门槛高度（cm），无台阶时为 0 */
  stepHeight: number;
  note: string;
}

export interface Area {
  id: string;
  name: string;
  measurement: Measurement;
}

export interface PhotoRecord {
  id: string;
  dataUrl: string;
  caption: string;
  takenAt: string;
}

export type IssueStatus = 'open' | 'fixed';
export type Severity = 'low' | 'medium' | 'high';

export interface Issue {
  id: string;
  title: string;
  description: string;
  /** 整改建议 */
  suggestion: string;
  /** 同一问题可关联多个区域 */
  areaIds: string[];
  severity: Severity;
  status: IssueStatus;
  /** 整改前照片 */
  beforePhotos: PhotoRecord[];
  /** 整改后照片，完成整改后保留前后记录 */
  afterPhotos: PhotoRecord[];
  createdAt: string;
  fixedAt: string | null;
}

export interface ProjectState {
  areas: Area[];
  issues: Issue[];
  thresholds: Thresholds;
}
