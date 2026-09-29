/** 可手动配置的规则阈值（单位：厘米） */
export interface Thresholds {
  /** 门净宽下限 */
  minDoorWidth: number;
  /** 通道净宽下限 */
  minPassageWidth: number;
  /** 允许的最大台阶/门槛高度，0 表示要求全无台阶 */
  maxStepHeight: number;
}

/** 住宅区域（玄关、卫生间、卧室等，可自定义增删） */
export interface Area {
  id: string;
  name: string;
  /** 门净宽 cm，未测量为 null */
  doorWidth: number | null;
  /** 通道净宽 cm */
  passageWidth: number | null;
  /** 台阶/门槛高度 cm，0 表示无台阶 */
  stepHeight: number | null;
  notes: string;
}

export interface Photo {
  id: string;
  /** 压缩后的 dataURL，离线保存在本地 */
  dataUrl: string;
  caption: string;
}

export type IssueStatus = 'open' | 'resolved';

/** 检查发现的问题，可关联多个区域，整改后保留前后照片记录 */
export interface Issue {
  id: string;
  title: string;
  description: string;
  /** 关联的区域 id 列表，同一问题可关联多个区域 */
  areaIds: string[];
  /** 整改建议 */
  suggestion: string;
  status: IssueStatus;
  /** 整改前照片 */
  beforePhotos: Photo[];
  /** 整改后照片 */
  afterPhotos: Photo[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface AppState {
  version: 1;
  areas: Area[];
  issues: Issue[];
  thresholds: Thresholds;
}
