import { describe, expect, it } from 'vitest';
import type { ClubState } from '../types';
import { reducer } from './store';

const base: ClubState = {
  books: [
    {
      id: 'b1',
      title: '书',
      author: '作者',
      createdAt: '2026-09-01T00:00:00Z',
      chapters: [{ id: 'c1', title: '第一章', order: 1 }],
    },
  ],
  members: [
    { id: 'm1', name: '甲' },
    { id: 'm2', name: '乙' },
  ],
  progress: [],
  excerpts: [
    {
      id: 'e1',
      bookId: 'b1',
      chapterId: 'c1',
      memberId: 'm1',
      text: '摘录',
      comments: [],
      createdAt: '2026-09-01T00:00:00Z',
    },
  ],
  questions: [],
  currentMemberId: 'm1',
};

describe('reducer', () => {
  it('每位成员的进度独立记录', () => {
    let s = reducer(base, {
      type: 'setProgress',
      memberId: 'm1',
      bookId: 'b1',
      chapterId: 'c1',
      status: 'done',
      now: '2026-09-30T00:00:00Z',
    });
    s = reducer(s, {
      type: 'setProgress',
      memberId: 'm2',
      bookId: 'b1',
      chapterId: 'c1',
      status: 'reading',
      now: '2026-09-30T00:00:00Z',
    });
    expect(s.progress).toHaveLength(2);
    // 同一成员重复标记会覆盖而非累加
    s = reducer(s, {
      type: 'setProgress',
      memberId: 'm1',
      bookId: 'b1',
      chapterId: 'c1',
      status: 'reading',
      now: '2026-09-30T01:00:00Z',
    });
    expect(s.progress).toHaveLength(2);
    expect(s.progress.find((p) => p.memberId === 'm1')?.status).toBe('reading');
  });

  it('同一段摘录可汇总多人讨论', () => {
    let s = reducer(base, {
      type: 'addComment',
      excerptId: 'e1',
      comment: { id: 'k1', memberId: 'm1', text: '同感', createdAt: '2026-09-30T00:00:00Z' },
    });
    s = reducer(s, {
      type: 'addComment',
      excerptId: 'e1',
      comment: { id: 'k2', memberId: 'm2', text: '补充一点', createdAt: '2026-09-30T01:00:00Z' },
    });
    const ex = s.excerpts.find((e) => e.id === 'e1');
    expect(ex?.comments.map((c) => c.memberId)).toEqual(['m1', 'm2']);
  });

  it('组织者可设置讨论日期与纪要', () => {
    let s = reducer(base, { type: 'setDiscussionDate', bookId: 'b1', chapterId: 'c1', date: '2026-10-05' });
    s = reducer(s, { type: 'setMinutes', bookId: 'b1', chapterId: 'c1', minutes: '纪要内容' });
    const ch = s.books[0].chapters[0];
    expect(ch.discussionDate).toBe('2026-10-05');
    expect(ch.minutes).toBe('纪要内容');
  });
});
