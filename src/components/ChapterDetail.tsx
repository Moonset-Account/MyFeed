import { useState } from 'react';
import type { Book, Chapter, ClubState } from '../types';
import type { Action } from '../lib/store';

interface Props {
  state: ClubState;
  dispatch: React.Dispatch<Action>;
  book: Book;
  chapter: Chapter;
  organizer: boolean;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ChapterDetail({ state, dispatch, book, chapter, organizer }: Props) {
  const me = state.currentMemberId;
  const memberName = (id: string) => state.members.find((m) => m.id === id)?.name ?? '未知成员';

  const [excerptText, setExcerptText] = useState('');
  const [excerptNote, setExcerptNote] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [questionText, setQuestionText] = useState('');
  const [minutesDraft, setMinutesDraft] = useState(chapter.minutes ?? '');

  const excerpts = state.excerpts.filter((e) => e.chapterId === chapter.id);
  const questions = state.questions.filter((q) => q.chapterId === chapter.id);

  function submitExcerpt(e: React.FormEvent) {
    e.preventDefault();
    const text = excerptText.trim();
    if (!text) return;
    dispatch({
      type: 'addExcerpt',
      excerpt: {
        id: crypto.randomUUID(),
        bookId: book.id,
        chapterId: chapter.id,
        memberId: me,
        text,
        note: excerptNote.trim() || undefined,
        comments: [],
        createdAt: new Date().toISOString(),
      },
    });
    setExcerptText('');
    setExcerptNote('');
  }

  function submitComment(excerptId: string) {
    const text = (commentDrafts[excerptId] ?? '').trim();
    if (!text) return;
    dispatch({
      type: 'addComment',
      excerptId,
      comment: { id: crypto.randomUUID(), memberId: me, text, createdAt: new Date().toISOString() },
    });
    setCommentDrafts((d) => ({ ...d, [excerptId]: '' }));
  }

  function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    const text = questionText.trim();
    if (!text) return;
    dispatch({
      type: 'addQuestion',
      question: {
        id: crypto.randomUUID(),
        bookId: book.id,
        chapterId: chapter.id,
        memberId: me,
        text,
        createdAt: new Date().toISOString(),
      },
    });
    setQuestionText('');
  }

  return (
    <div className="chapter-detail">
      <div className="detail-grid">
        <section className="detail-block">
          <h4>🗓 讨论日期</h4>
          {organizer ? (
            <input
              type="date"
              value={chapter.discussionDate ?? ''}
              onChange={(e) =>
                dispatch({
                  type: 'setDiscussionDate',
                  bookId: book.id,
                  chapterId: chapter.id,
                  date: e.target.value || undefined,
                })
              }
            />
          ) : (
            <p>{chapter.discussionDate ?? '未定'}</p>
          )}
        </section>

        <section className="detail-block">
          <h4>📝 讨论纪要</h4>
          {organizer ? (
            <div className="minutes-editor">
              <textarea
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                placeholder="记录本章讨论的结论、分歧与后续行动…"
                rows={5}
              />
              <button
                className="small"
                onClick={() =>
                  dispatch({
                    type: 'setMinutes',
                    bookId: book.id,
                    chapterId: chapter.id,
                    minutes: minutesDraft,
                  })
                }
              >
                保存纪要
              </button>
            </div>
          ) : chapter.minutes ? (
            <p className="minutes-text">{chapter.minutes}</p>
          ) : (
            <p className="muted">暂无纪要</p>
          )}
        </section>
      </div>

      <section className="detail-block">
        <h4>✂️ 摘录与讨论（{excerpts.length}）</h4>
        {excerpts.length === 0 && <p className="muted">还没有摘录，来贴第一段打动你的文字吧。</p>}
        <ul className="excerpt-list">
          {excerpts.map((ex) => (
            <li key={ex.id} className="excerpt-card">
              <blockquote>{ex.text}</blockquote>
              <p className="muted">
                {memberName(ex.memberId)} · {fmtTime(ex.createdAt)}
                {ex.note ? ` · 心得：${ex.note}` : ''}
              </p>
              {ex.comments.length > 0 && (
                <ul className="comment-list">
                  {ex.comments.map((c) => (
                    <li key={c.id}>
                      <strong>{memberName(c.memberId)}</strong>：{c.text}
                      <span className="muted"> · {fmtTime(c.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="inline-form">
                <input
                  value={commentDrafts[ex.id] ?? ''}
                  onChange={(e) =>
                    setCommentDrafts((d) => ({ ...d, [ex.id]: e.target.value }))
                  }
                  placeholder="就这段摘录说两句…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitComment(ex.id);
                    }
                  }}
                />
                <button className="small" onClick={() => submitComment(ex.id)}>
                  讨论
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form className="excerpt-form" onSubmit={submitExcerpt}>
          <textarea
            value={excerptText}
            onChange={(e) => setExcerptText(e.target.value)}
            placeholder="摘录原文…"
            rows={2}
            required
          />
          <div className="inline-form">
            <input
              value={excerptNote}
              onChange={(e) => setExcerptNote(e.target.value)}
              placeholder="心得（可选）"
            />
            <button type="submit" className="small">
              发布摘录
            </button>
          </div>
        </form>
      </section>

      <section className="detail-block">
        <h4>❓ 提问（{questions.length}）</h4>
        {questions.length === 0 && <p className="muted">暂无提问。</p>}
        <ul className="question-list">
          {questions.map((q) => (
            <li key={q.id}>
              <strong>{memberName(q.memberId)}</strong>：{q.text}
              <span className="muted"> · {fmtTime(q.createdAt)}</span>
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={submitQuestion}>
          <input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="向书友提一个问题…"
          />
          <button type="submit" className="small">
            提问
          </button>
        </form>
      </section>
    </div>
  );
}
