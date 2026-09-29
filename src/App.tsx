import { useEffect, useState } from 'react';
import type { ProjectState } from './types';
import { loadState, saveState } from './logic/store';
import { AreasView } from './components/AreasView';
import { IssuesView } from './components/IssuesView';
import { SummaryView } from './components/SummaryView';
import { ReportView } from './components/ReportView';
import { SettingsView } from './components/SettingsView';

type Tab = 'areas' | 'issues' | 'summary' | 'report' | 'settings';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'areas', label: '区域测量' },
  { key: 'issues', label: '问题与整改' },
  { key: 'summary', label: '区域汇总' },
  { key: 'report', label: '打印报告' },
  { key: 'settings', label: '阈值设置' },
];

export default function App() {
  const [state, setState] = useState<ProjectState>(loadState);
  const [tab, setTab] = useState<Tab>('areas');

  useEffect(() => {
    saveState(state);
  }, [state]);

  // 删除区域时同步清理问题中的失效引用
  const setAreas = (areas: ProjectState['areas']) =>
    setState((s) => {
      const ids = new Set(areas.map((a) => a.id));
      return {
        ...s,
        areas,
        issues: s.issues.map((i) => ({ ...i, areaIds: i.areaIds.filter((id) => ids.has(id)) })),
      };
    });

  return (
    <div className="app">
      <header className="no-print">
        <h1>无障碍检查清单</h1>
        <p className="hint">家居改造顾问 · 数据保存在本机浏览器，可离线使用</p>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : 'ghost'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'areas' && (
          <AreasView areas={state.areas} thresholds={state.thresholds} onChange={setAreas} />
        )}
        {tab === 'issues' && (
          <IssuesView
            areas={state.areas}
            issues={state.issues}
            onChange={(issues) => setState((s) => ({ ...s, issues }))}
          />
        )}
        {tab === 'summary' && (
          <SummaryView areas={state.areas} issues={state.issues} thresholds={state.thresholds} />
        )}
        {tab === 'report' && <ReportView state={state} />}
        {tab === 'settings' && (
          <SettingsView
            thresholds={state.thresholds}
            onChange={(thresholds) => setState((s) => ({ ...s, thresholds }))}
          />
        )}
      </main>
    </div>
  );
}
