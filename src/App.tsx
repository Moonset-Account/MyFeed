import { useState } from 'react';
import { useAppStore } from './store';
import { AreaPanel } from './components/AreaPanel';
import { IssuePanel } from './components/IssuePanel';
import { ReportPanel } from './components/ReportPanel';
import { ThresholdPanel } from './components/ThresholdPanel';

type Tab = 'areas' | 'issues' | 'report' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'areas', label: '检查记录' },
  { key: 'issues', label: '问题与整改' },
  { key: 'report', label: '汇总报告' },
  { key: 'settings', label: '阈值设置' },
];

export default function App() {
  const { state, dispatch } = useAppStore();
  const [tab, setTab] = useState<Tab>('areas');

  return (
    <div className="app">
      <header className="app-header no-print">
        <h1>无障碍检查清单</h1>
        <p>家居改造顾问 · 按区域记录测量、问题与整改前后对照</p>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className={tab === 'report' ? '' : 'no-print'}>
        {tab === 'areas' && (
          <AreaPanel areas={state.areas} thresholds={state.thresholds} dispatch={dispatch} />
        )}
        {tab === 'issues' && (
          <IssuePanel areas={state.areas} issues={state.issues} dispatch={dispatch} />
        )}
        {tab === 'report' && (
          <ReportPanel areas={state.areas} issues={state.issues} thresholds={state.thresholds} />
        )}
        {tab === 'settings' && <ThresholdPanel thresholds={state.thresholds} dispatch={dispatch} />}
      </main>

      {/* 打印时始终输出报告，无论当前处于哪个标签页 */}
      {tab !== 'report' && (
        <div className="print-only">
          <ReportPanel areas={state.areas} issues={state.issues} thresholds={state.thresholds} />
        </div>
      )}
    </div>
  );
}
