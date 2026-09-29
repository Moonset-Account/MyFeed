export type LightPosition = 'full-sun' | 'half-sun' | 'bright-indirect' | 'shade';

export const LIGHT_LABELS: Record<LightPosition, string> = {
  'full-sun': '全日照（南阳台）',
  'half-sun': '半日照（东/西阳台）',
  'bright-indirect': '明亮散射光',
  shade: '耐阴（室内/北阳台）'
};

export type CareType = 'water' | 'fertilize' | 'repot';

export const CARE_LABELS: Record<CareType, string> = {
  water: '浇水',
  fertilize: '施肥',
  repot: '换盆'
};

export interface Plant {
  id: string;
  name: string;
  species: string;
  /** 照片占位图标（emoji），代替真实照片 */
  icon: string;
  light: LightPosition;
  waterIntervalDays: number;
  /** 为空表示不跟踪施肥周期 */
  fertilizeIntervalDays: number | null;
  createdAt: string; // YYYY-MM-DD
}

export interface CareEvent {
  id: string;
  plantId: string;
  type: CareType;
  date: string; // YYYY-MM-DD，实际养护日期
  note: string;
}

/** 阴雨顺延：只推迟待办到期日，不等于完成浇水 */
export interface Postponement {
  id: string;
  plantId: string;
  days: number;
  reason: string;
  createdAt: string; // YYYY-MM-DD
}
