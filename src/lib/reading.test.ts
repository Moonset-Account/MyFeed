import { describe, expect, it } from 'vitest';
import type { Book, ClubState } from '../types';
import {
  bookProgress,
  chapterStatus,
  daysUntil,
  parseBackup,
  parseISODate,
  serializeState,
  toISODate,
  unreadReminders,
} from './reading';

const book: Book = {
  id: 'b1',
  title: '测试书',
  author: '作者',
  createdAt: '2026-09-01T00:00:00.000Z',
  chapters: [
    { id: 'c1', title: '第一章', order: 1, discussionDate: '2026-09-28' },
    { id: 'c2', title: '第二章', order: 2, discussionDate: '2026-10-02' },
    { id: 'c3', title: '第三章', order: 3 },
  ],
};

const state: ClubState = {
  books: [book],
  members: [
    { id: 'm1', name: '甲' },
    { id: 'm2', name: '乙' },
  ],
  progress: [
    { memberId: 'm1', bookId: 'b1', chapterId: 'c1', status: 'done', updatedAt: '2026-09-20T00:00:00Z' },
    { memberId: 'm2', bookId: 'b1', chapterId: 'c1', status: 'reading', updatedAt: '2026-09-20T00:00:00Z' },
  ],
  excerpts: [],
  questions: [],
  currentMemberId: 'm1',
};

const today = new Date(2026, 8, 30); // 2026-09-30 本地时间

describe('chapterStatus', () => {
  it('缺省为未读，且成员之间互不影响', () => {
    expect(chapterStatus(state.progress, 'm1', 'c1')).toBe('done');
    expect(chapterStatus(state.progress, 'm2', 'c1')).toBe('reading');
    expect(chapterStatus(state.progress, 'm1', 'c2')).toBe('unread');
  });
});

describe('日期工具', () => {
  it('本地日期往返转换', () => {
    expect(toISODate(parseISODate('2026-09-30'))).toBe('2026-09-30');
  });

  it('daysUntil 计算相对天数', () => {
    expect(daysUntil('2026-09-30', today)).toBe(0);
    expect(daysUntil('2026-10-02', today)).toBe(2);
    expect(daysUntil('2026-09-28', today)).toBe(-2);
  });
});

describe('unreadReminders', () => {
  it('只提醒有讨论日期且未读完的章节，按紧迫排序', () => {
    const r = unreadReminders(state, 'm1', today);
    expect(r.map((x) => x.chapterId)).toEqual(['c2']); // c1 已读完，c3 无日期
    expect(r[0].daysLeft).toBe(2);
  });

  it('已逾期的章节排在最前', () => {
    const r = unreadReminders(state, 'm2', today);
    expect(r.map((x) => x.chapterId)).toEqual(['c1', 'c2']);
    expect(r[0].daysLeft).toBe(-2);
  });
});

describe('bookProgress', () => {
  it('汇总个人进度百分比', () => {
    expect(bookProgress(book, state.progress, 'm1')).toEqual({
      done: 1,
      reading: 0,
      total: 3,
      percent: 33,
    });
    expect(bookProgress(book, state.progress, 'm2').percent).toBe(0);
  });
});

describe('JSON 备份', () => {
  it('导出后可完整导入（往返一致）', () => {
    const restored = parseBackup(serializeState(state));
    expect(restored).toEqual(state);
  });

  it('拒绝非法 JSON 与缺字段的备份', () => {
    expect(() => parseBackup('not json')).toThrow('有效的 JSON');
    expect(() => parseBackup('{"data":{"books":[]}}')).toThrow('成员');
    expect(() => parseBackup('{"books":[{"id":"b"}],"members":[]}')).toThrow('不完整');
  });

  it('currentMemberId 失效时回退到第一个成员', () => {
    const broken = { ...state, currentMemberId: 'ghost' };
    expect(parseBackup(JSON.stringify(broken)).currentMemberId).toBe('m1');
  });
});
