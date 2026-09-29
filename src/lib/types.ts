/** 照护事项类型：喂食、遛狗、清洁、用药 */
export type CareType = 'feeding' | 'walking' | 'cleaning' | 'medication';

export const CARE_TYPE_LABELS: Record<CareType, string> = {
  feeding: '喂食',
  walking: '遛狗',
  cleaning: '清洁',
  medication: '用药'
};

export interface Pet {
  id: string;
  name: string;
  species: string;
  emoji: string;
  note: string;
}

/** 每日重复的照护事项模板 */
export interface TaskTemplate {
  id: string;
  petId: string;
  type: CareType;
  title: string;
  /** 计划时间，格式 HH:mm */
  time: string;
  instruction: string;
}

/** 某个日期下的具体事项实例 */
export interface TaskInstance {
  /** `${templateId}@${date}`，同一模板同一天唯一 */
  instanceId: string;
  templateId: string;
  date: string;
  petId: string;
  type: CareType;
  title: string;
  time: string;
  instruction: string;
}

/** 一条交接（完成）记录 */
export interface CompletionRecord {
  id: string;
  instanceId: string;
  date: string;
  taskTitle: string;
  petName: string;
  /** 完成时间，ISO 字符串 */
  completedAt: string;
  /** 执行人 */
  completedBy: string;
  note: string;
  /** 是否为重复确认（该事项此前已有完成记录） */
  duplicate: boolean;
}
