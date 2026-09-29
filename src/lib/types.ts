export interface Chapter {
  id: string;
  name: string;
  /** 熟练度 1(陌生) - 5(熟练) */
  proficiency: number;
  /** 完成日期 YYYY-MM-DD；null 表示未完成。完成记录永久保留。 */
  completedAt: string | null;
}

export interface Course {
  id: string;
  name: string;
  /** 考试日期 YYYY-MM-DD */
  examDate: string;
  chapters: Chapter[];
}

export interface PlanItem {
  courseId: string;
  chapterId: string;
}

export interface DayPlan {
  date: string;
  items: PlanItem[];
}

export interface PersistedState {
  courses: Course[];
  /** 缺席日期 YYYY-MM-DD 列表，缺席日不安排复习 */
  absentDates: string[];
}
