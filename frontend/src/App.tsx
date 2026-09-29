import { useMemo, useState } from 'react';
import { regressionSample } from './sample';
import type { CompareResponse, Finding, OperationReport, Severity } from './types';

const endpoint = '/api/compare';

const labels: Record<Severity, string> = {
  compatible: '兼容',
  breaking: '破坏',
  unknown: '未知',
};

const severityClass: Record<Severity, string> = {
  compatible: 'ok',
  breaking: 'bad',
  unknown: 'warn',
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function compare(oldText: string, newText: string): Promise<CompareResponse> {
  let oldDoc: unknown;
  let newDoc: unknown;
  try {
    oldDoc = JSON.parse(oldText);
  } catch (error) {
    return { errors: [`旧 JSON 无法解析：${(error as Error).message}`], summary: null, operations: [] };
  }
  try {
    newDoc = JSON.parse(newText);
  } catch (error) {
    return { errors: [`新 JSON 无法解析：${(error as Error).message}`], summary: null, operations: [] };
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ old: oldDoc, new: newDoc }),
  });
  if (!response.ok) throw new Error(`API 请求失败：${response.status}`);
  return response.json();
}

function RefChain({ title, chain }: { title: string; chain: string[] }) {
  if (!chain.length) return null;
  return (
    <div className="chain">
      <span>{title}</span>
      <code>{chain.join(' → ')}</code>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`finding ${severityClass[finding.severity]}`}>
      <button type="button" onClick={() => setOpen(!open)}>
        <span className={`badge ${severityClass[finding.severity]}`}>{labels[finding.severity]}</span>
        <span className="direction">{finding.direction === 'request' ? '请求' : '响应'}</span>
        <strong>{finding.message}</strong>
        <span className="chevron">{open ? '收起' : '查看'}</span>
      </button>
      {open && (
        <div className="detail">
          <p><b>具体约束：</b><code>{finding.constraint || '未提供'}</code></p>
          <div className="locations">
            <div><b>旧侧位置</b><code>{finding.oldLocation}</code></div>
            <div><b>新侧位置</b><code>{finding.newLocation}</code></div>
          </div>
          <RefChain title="旧侧引用链" chain={finding.oldRefChain} />
          <RefChain title="新侧引用链" chain={finding.newRefChain} />
          {finding.failureExample && (
            <div>
              <b>会失败的旧请求 / 新响应</b>
              <pre>{formatJson(finding.failureExample)}</pre>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function OperationCard({ operation }: { operation: OperationReport }) {
  const [open, setOpen] = useState(operation.severity !== 'compatible');
  return (
    <section className="operation">
      <button type="button" className="operation-head" onClick={() => setOpen(!open)}>
        <span className={`badge ${severityClass[operation.severity]}`}>{labels[operation.severity]}</span>
        <span className="method">{operation.method}</span>
        <code>{operation.path}</code>
        <span>{operation.findings.length} 项</span>
      </button>
      {open && (
        <div className="findings">
          {operation.findings.length === 0 ? (
            <p className="muted">已按路径和方法对齐，未发现可判定差异。</p>
          ) : (
            operation.findings.map((finding, index) => <FindingCard key={`${finding.kind}-${index}`} finding={finding} />)
          )}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [oldText, setOldText] = useState(() => JSON.stringify(regressionSample.old, null, 2));
  const [newText, setNewText] = useState(() => JSON.stringify(regressionSample.new, null, 2));
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  const operations = useMemo(() => {
    if (!result?.operations) return [];
    return filter === 'all' ? result.operations : result.operations.filter((item) => item.severity === filter);
  }, [filter, result]);

  async function run() {
    setLoading(true);
    setError('');
    try {
      setResult(await compare(oldText, newText));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setOldText(JSON.stringify(regressionSample.old, null, 2));
    setNewText(JSON.stringify(regressionSample.new, null, 2));
    setResult(null);
    setFilter('all');
  }

  return (
    <main>
      <header className="hero">
        <div>
          <h1>离线 OpenAPI 3.0 契约审查</h1>
          <p>面向“新服务替换旧服务”：请求新增约束和响应失去保证分别判断，局部未知不会覆盖确定破坏。</p>
        </div>
        <button type="button" className="secondary" onClick={loadSample}>载入回归样例</button>
      </header>

      <div className="editors">
        <label>旧服务 JSON（当前调用方依赖）
          <textarea value={oldText} onChange={(event) => setOldText(event.target.value)} spellCheck={false} />
        </label>
        <label>新服务 JSON（替换实现）
          <textarea value={newText} onChange={(event) => setNewText(event.target.value)} spellCheck={false} />
        </label>
      </div>

      <div className="toolbar">
        <button type="button" onClick={run} disabled={loading}>{loading ? '审查中…' : '开始审查'}</button>
        {result?.summary && (
          <div className="summary">
            <span className="bad">破坏 {result.summary.breaking}</span>
            <span className="warn">未知 {result.summary.unknown}</span>
            <span className="ok">兼容 {result.summary.compatible}</span>
            <span>共 {result.summary.total}</span>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {result?.errors?.map((item) => <p className="error" key={item}>{item}</p>)}

      {result?.summary && (
        <>
          <nav className="filters">
            {(['all', 'breaking', 'unknown', 'compatible'] as const).map((item) => (
              <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
                {item === 'all' ? '全部' : labels[item]}
              </button>
            ))}
          </nav>
          <div className="results">
            {operations.map((operation) => (
              <OperationCard key={`${operation.method}-${operation.path}`} operation={operation} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
