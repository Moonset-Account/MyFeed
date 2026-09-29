import { useState } from 'react';
import type { Book, ClubState } from '../types';
import type { Action } from '../lib/store';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  bookProgress,
  chapterStatus,
  unreadReminders,
  type Reminder,
} from '../lib/reading';
import ChapterDetail from './ChapterDetail';

interface Props {
  state: ClubState;
  dispatch: React.Dispatch<Action>;
  book: Book;
  organizer: boolean;
}

function reminderText(r: Reminder): string {
  if (r.daysLeft < 0) return `已逾期 ${-r.daysLeft} 天`;
  if (r.daysLeft === 0) return '今天讨论';
  return `还剩 ${r.daysLeft} 天`;
}

export default function BookView({ state, dispatch, book, organizer }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');

  const me = state.currentMemberId;
  const progress = bookProgress(book, state.progress, me);
  const reminders = unreadReminders(state, me).filter((r) => r.bookId === book.id);
  const reminderByChapter = new Map(reminders.map((r) => [r.chapterId, r]));
  const sortedChapters = [...book.chapters].sort((a, b) => a.order - b.order);

  function submitChapter(e: React.FormEvent) {
    e.preventDefault();
    const t = chapterTitle.trim();
    if (!t) return;
    dispatch({
      type: 'addChapter',
      bookId: book.id,
      chapter: {
        id: crypto.randomUUID(),
        title: t,
        order: book.chapters.length + 1,
      },
    });
    setChapterTitle('');
    setAddingChapter(false);
  }

  return (
    <div className="book-view">
      <header className="book-header">
        <div>
          <h2>《{book.title}》</h2>
          <p className="muted">{book.author} · 共 {book.chapters.length} 章</p>
        </div>
        <div className="my-progress">
          <span className="muted">我的进度</span>
          <span className="progress-track wide">
            <span className="progress-fill" style={{ width: `${progress.percent}%` }} />
          </span>
          <strong>{progress.percent}%</strong>
        </div>
      </header>

      {reminders.length > 0 && (
        <section className="reminders">
          <h3>⏰ 未读章节提醒</h3>
          <ul>
            {reminders.map((r) => (
              <li key={r.chapterId} className={r.daysLeft < 0 ? 'overdue' : ''}>
                <span className="reminder-chapter">{r.chapterTitle}</span>
                <span className="muted">讨论日 {r.discussionDate}</span>
                <span className="reminder-days">{reminderText(r)}</span>
                <span className={`status-tag ${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="chapters">
        <div className="section-head">
          <h3>章节</h3>
          {organizer && (
            <button className="ghost small" onClick={() => setAddingChapter((v) => !v)}>
              {addingChapter ? '收起' : '+ 添加章节'}
            </button>
          )}
        </div>

        {addingChapter && (
          <form className="inline-form" onSubmit={submitChapter}>
            <input
              autoFocus
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="章节标题"
            />
            <button type="submit">添加</button>
          </form>
        )}

        {sortedChapters.length === 0 && (
          <p className="muted">还没有章节。{organizer ? '点击上方「添加章节」。' : '等待组织者添加。'}</p>
        )}

        <ul className="chapter-list">
          {sortedChapters.map((ch) => {
            const myStatus = chapterStatus(state.progress, me, ch.id);
            const reminder = reminderByChapter.get(ch.id);
            const expanded = expandedId === ch.id;
            const excerptCount = state.excerpts.filter((x) => x.chapterId === ch.id).length;
            const questionCount = state.questions.filter((q) => q.chapterId === ch.id).length;
            return (
              <li key={ch.id} className="chapter-card">
                <div className="chapter-row">
                  <button
                    className="chapter-toggle"
                    onClick={() => setExpandedId(expanded ? null : ch.id)}
                    title={expanded ? '收起' : '展开'}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <div className="chapter-main">
                    <div className="chapter-title-line">
                      <strong>{ch.title}</strong>
                      {ch.discussionDate ? (
                        <span className="date-chip">🗓 {ch.discussionDate}</span>
                      ) : (
                        <span className="date-chip none">未定讨论日期</span>
                      )}
                      {reminder && (
                        <span className={`date-chip warn${reminder.daysLeft < 0 ? ' overdue' : ''}`}>
                          {reminderText(reminder)}
                        </span>
                      )}
                      {excerptCount > 0 && <span className="meta-chip">✂️ {excerptCount} 摘录</span>}
                      {questionCount > 0 && <span className="meta-chip">❓ {questionCount} 提问</span>}
                      {ch.minutes && <span className="meta-chip">📝 有纪要</span>}
                    </div>
                    <div className="chapter-sub">
                      <div className="status-picker" role="group" aria-label="我的阅读状态">
                        {STATUS_ORDER.map((s) => (
                          <button
                            key={s}
                            className={`status-btn ${s}${myStatus === s ? ' on' : ''}`}
                            onClick={() =>
                              dispatch({
                                type: 'setProgress',
                                memberId: me,
                                bookId: book.id,
                                chapterId: ch.id,
                                status: s,
                                now: new Date().toISOString(),
                              })
                            }
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                      <div className="member-dots" title="各成员进度">
                        {state.members.map((m) => {
                          const st = chapterStatus(state.progress, m.id, ch.id);
                          return (
                            <span
                              key={m.id}
                              className={`dot ${st}`}
                              title={`${m.name}：${STATUS_LABEL[st]}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <ChapterDetail
                    state={state}
                    dispatch={dispatch}
                    book={book}
                    chapter={ch}
                    organizer={organizer}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
