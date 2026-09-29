import { useEffect, useReducer, useState } from 'react';
import { loadState, reducer, STORAGE_KEY } from './lib/store';
import { parseBackup, serializeState, toISODate } from './lib/reading';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import BookView from './components/BookView';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const selectedBook =
    state.books.find((b) => b.id === selectedBookId) ?? state.books[0] ?? null;

  function handleExport() {
    const blob = new Blob([serializeState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-club-backup-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const next = parseBackup(text);
      dispatch({ type: 'replaceAll', state: next });
      window.alert('备份导入成功');
    } catch (err) {
      window.alert(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="app">
      <TopBar
        state={state}
        dispatch={dispatch}
        organizer={organizer}
        onToggleOrganizer={() => setOrganizer((v) => !v)}
        onExport={handleExport}
        onImport={handleImport}
      />
      <div className="layout">
        <Sidebar
          state={state}
          dispatch={dispatch}
          organizer={organizer}
          selectedBookId={selectedBook?.id ?? null}
          onSelect={setSelectedBookId}
        />
        <main className="main">
          {selectedBook ? (
            <BookView
              key={selectedBook.id}
              state={state}
              dispatch={dispatch}
              book={selectedBook}
              organizer={organizer}
            />
          ) : (
            <div className="empty">
              <h2>还没有书目</h2>
              <p>打开右上角「组织者」开关，在左侧添加第一本书。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
