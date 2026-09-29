import { searchSteps } from '../lib/assembly';
import type { AssemblyPlan, ProgressState } from '../lib/types';

interface Props {
  plan: AssemblyPlan;
  progress: ProgressState;
  query: string;
  currentIndex: number;
  onQueryChange: (q: string) => void;
  onSelect: (index: number) => void;
}

/** 左侧步骤导航：搜索 + 有序步骤列表 */
export function StepNav({ plan, progress, query, currentIndex, onQueryChange, onSelect }: Props) {
  const matches = searchSteps(plan, query);
  return (
    <nav className="step-nav" aria-label="步骤导航">
      <input
        type="search"
        className="search-input"
        placeholder="搜索步骤、零件或工具…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="搜索步骤"
      />
      {query.trim() && (
        <p className="search-meta">
          匹配 {matches.length} / {plan.steps.length} 步
        </p>
      )}
      <ol className="step-list">
        {matches.map((i) => {
          const step = plan.steps[i];
          const done = progress.completedStepIds.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                className={`step-link ${i === currentIndex ? 'is-current' : ''} ${done ? 'is-done' : ''}`}
                onClick={() => onSelect(i)}
              >
                <span className="step-link-index">{i + 1}</span>
                <span className="step-link-title">{step.title}</span>
                {step.checkpoint?.required && <span className="req-dot" title="含必需检查点">!</span>}
                {done && <span className="done-mark" aria-label="已完成">✓</span>}
              </button>
            </li>
          );
        })}
        {matches.length === 0 && <li className="no-match">没有匹配的步骤</li>}
      </ol>
    </nav>
  );
}
