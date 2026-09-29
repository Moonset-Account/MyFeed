import type { Book, ClubState, ProgressEntry, ProgressStatus } from '../types';

export const STATUS_LABEL: Record<ProgressStatus, string> = {
  unread: '未读',
  reading: '在读',
  done: '读完',
};

export const STATUS_ORDER: ProgressStatus[] = ['unread', 'reading', 'done'];

/** 查询某成员对某章的进度，缺省为未读 */
export function chapterStatus(
  progress: ProgressEntry[],
  memberId: string,
  chapterId: string,
): ProgressStatus {
  const hit = progress.find((p) => p.memberId === memberId && p.chapterId === chapterId);
  return hit ? hit.status : 'unread';
}

/** 把 yyyy-mm-dd 解析为本地日期（避免 UTC 解析带来的时区偏移） */
export function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`无效日期: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 格式化为本地 yyyy-mm-dd */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 讨论日期相对今天的天数：0 今天，负数表示已逾期 */
export function daysUntil(dateISO: string, today: Date = new Date()): number {
  const target = parseISODate(dateISO);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

export interface Reminder {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  discussionDate: string;
  daysLeft: number;
  status: ProgressStatus;
}

/** 未读章节提醒：有讨论日期且本人尚未读完的章节，按紧迫程度排序 */
export function unreadReminders(
  state: ClubState,
  memberId: string,
  today: Date = new Date(),
): Reminder[] {
  const res: Reminder[] = [];
  for (const book of state.books) {
    for (const ch of book.chapters) {
      if (!ch.discussionDate) continue;
      const status = chapterStatus(state.progress, memberId, ch.id);
      if (status === 'done') continue;
      res.push({
        bookId: book.id,
        bookTitle: book.title,
        chapterId: ch.id,
        chapterTitle: ch.title,
        discussionDate: ch.discussionDate,
        daysLeft: daysUntil(ch.discussionDate, today),
        status,
      });
    }
  }
  return res.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface BookProgress {
  done: number;
  reading: number;
  total: number;
  percent: number;
}

/** 某成员在单本书上的进度汇总 */
export function bookProgress(
  book: Book,
  progress: ProgressEntry[],
  memberId: string,
): BookProgress {
  let done = 0;
  let reading = 0;
  for (const ch of book.chapters) {
    const s = chapterStatus(progress, memberId, ch.id);
    if (s === 'done') done += 1;
    else if (s === 'reading') reading += 1;
  }
  const total = book.chapters.length;
  return { done, reading, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export const BACKUP_VERSION = 1;

/** 导出为本地 JSON 备份文本 */
export function serializeState(state: ClubState): string {
  return JSON.stringify(
    { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: state },
    null,
    2,
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertArray(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`备份缺少 ${name} 列表`);
  return v;
}

/** 解析并校验 JSON 备份；兼容带版本包装与裸状态两种格式 */
export function parseBackup(json: string): ClubState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }
  if (!isRecord(raw)) throw new Error('备份内容结构不正确');
  const data: unknown = isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(data)) throw new Error('备份内容结构不正确');

  const books = assertArray(data.books, '书目');
  const members = assertArray(data.members, '成员');
  for (const b of books) {
    if (!isRecord(b) || typeof b.id !== 'string' || typeof b.title !== 'string' || !Array.isArray(b.chapters)) {
      throw new Error('备份中的书目记录不完整');
    }
  }
  for (const m of members) {
    if (!isRecord(m) || typeof m.id !== 'string' || typeof m.name !== 'string') {
      throw new Error('备份中的成员记录不完整');
    }
  }
  if (members.length === 0) throw new Error('备份中至少需要一个成员');

  const state: ClubState = {
    books: books as ClubState['books'],
    members: members as ClubState['members'],
    progress: Array.isArray(data.progress) ? (data.progress as ClubState['progress']) : [],
    excerpts: Array.isArray(data.excerpts) ? (data.excerpts as ClubState['excerpts']) : [],
    questions: Array.isArray(data.questions) ? (data.questions as ClubState['questions']) : [],
    currentMemberId:
      typeof data.currentMemberId === 'string' &&
      members.some((m) => (m as { id: string }).id === data.currentMemberId)
        ? (data.currentMemberId as string)
        : (members[0] as { id: string }).id,
  };
  return state;
}
