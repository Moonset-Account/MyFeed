import { useState } from 'react';
import type { Book, ClubState } from '../types';
import type { Action } from '../lib/store';
import { bookProgress, unreadReminders } from '../lib/reading';

interface Props {
  state: ClubState;
  dispatch: React.Dispatch<Action>;
  organizer: boolean;
  selectedBookId: string | null;
  onSelect: (bookId: string) => void;
}

export default function Sidebar({ state, dispatch, organizer, selectedBookId, onSelect }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapterLines, setChapterLines] = useState('');

  const myReminders = unreadReminders(state, state.currentMemberId);

  function submitBook(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const chapters = chapterLines
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line, i) => ({ id: crypto.randomUUID(), title: line, order: i + 1 }));
    const book: Book = {
      id: crypto.randomUUID(),
      title: t,
      author: author.trim() || '佚名',
      chapters,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'addBook', book });
    onSelect(book.id);
    setTitle('');
    setAuthor('');
    setChapterLines('');
    setAdding(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2>书目</h2>
        {organizer && (
          <button className="ghost small" onClick={() => setAdding((v) => !v)}>
            {adding ? '收起' : '+ 添加书目'}
          </button>
        )}
      </div>

      {adding && (
        <form className="add-book" onSubmit={submitBook}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="书名" required />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="作者" />
          <textarea
            value={chapterLines}
            onChange={(e) => setChapterLines(e.target.value)}
            placeholder={'章节（每行一章）\n第一章 …\n第二章 …'}
            rows={4}
          />
          <button type="submit">创建书目</button>
        </form>
      )}

      <ul className="book-list">
        {state.books.map((b) => {
          const p = bookProgress(b, state.progress, state.currentMemberId);
          const pending = myReminders.filter((r) => r.bookId === b.id).length;
          return (
            <li key={b.id}>
              <button
                className={`book-item${b.id === selectedBookId ? ' active' : ''}`}
                onClick={() => onSelect(b.id)}
              >
                <span className="book-title">
                  《{b.title}》
                  {pending > 0 && <span className="dot-badge">{pending}</span>}
                </span>
                <span className="book-author">{b.author}</span>
                <span className="progress-track">
                  <span className="progress-fill" style={{ width: `${p.percent}%` }} />
                </span>
                <span className="book-progress-text">
                  {p.done}/{p.total} 章
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
