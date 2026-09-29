/** 阅读进度状态：未读 / 在读 / 读完 */
export type ProgressStatus = 'unread' | 'reading' | 'done';

export interface Chapter {
  id: string;
  title: string;
  order: number;
  /** 讨论日期，本地日期 ISO 格式 yyyy-mm-dd；未设置则为 undefined */
  discussionDate?: string;
  /** 讨论纪要（Markdown 纯文本） */
  minutes?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  chapters: Chapter[];
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
}

/** 每位成员对每章的进度互相独立 */
export interface ProgressEntry {
  memberId: string;
  bookId: string;
  chapterId: string;
  status: ProgressStatus;
  updatedAt: string;
}

export interface ExcerptComment {
  id: string;
  memberId: string;
  text: string;
  createdAt: string;
}

/** 摘录：同一段摘录下可汇总多位成员的讨论 */
export interface Excerpt {
  id: string;
  bookId: string;
  chapterId: string;
  memberId: string;
  text: string;
  note?: string;
  comments: ExcerptComment[];
  createdAt: string;
}

export interface Question {
  id: string;
  bookId: string;
  chapterId: string;
  memberId: string;
  text: string;
  createdAt: string;
}

export interface ClubState {
  books: Book[];
  members: Member[];
  progress: ProgressEntry[];
  excerpts: Excerpt[];
  questions: Question[];
  currentMemberId: string;
}
