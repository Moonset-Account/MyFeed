import { useMemo, useState } from 'react';
import { reviewContracts } from './api';
import type { Finding, OperationGroup, ReviewResult, ReviewStatus } from './types';

const DEMO_OLD = {
  openapi: '3.0.0',
  info: { title: 'Orders old', version: '1.0.0', description: '旧描述' },
  paths: {
    '/orders/{id}': {
      get: {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'identifier',
            schema: { $ref: '#/components/schemas/Id' },
          },
          {
            name: 'mode',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['fast', 'safe'], description: '运行模式' },
          },
        ],
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Id: { type: 'string', description: '只改描述不会报' },
      Order: {
        type: 'object',
        required: ['id', 'state'],
        properties: {
          id: { type: 'string' },
          state: { type: 'string', enum: ['new', 'paid', 'cancelled'] },
          customer: { $ref: '#/components/schemas/Customer' },
        },
      },
      Customer: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    },
  },
};

const DEMO_NEW = {
  openapi: '3.0.0',
  info: { title: 'Orders new', version: '2.0.0', description: '新描述，不影响判定' },
  paths: {
    '/orders/{id}': {
      get: {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { $ref: '#/components/schemas/Id' } },
          {
            name: 'mode',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['safe'] },
          },
        ],
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Order' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Id: { type: 'string', description: '描述改变' },
      Order: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          state: { type: 'string', enum: ['new', 'paid', 'refunded'] },
          customer: { $ref: '#/components/schemas/Customer' },
        },
      },
      Customer: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    },
  },
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  compatible: '兼容',
  breaking: '破坏',
  unknown: '未知',
};

const DIRECTION_LABEL: Record<string, string> = {
  request: '请求',
  response: '响应',
  path: '路径',
  operation: '操作',
};

function App() {
  const [oldText, setOldText] = useState(JSON.stringify(DEMO_OLD, null, 2));
  const [newText, setNewText] = useState(JSON.stringify(DEMO_NEW, null, 2));
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function runReview() {
    setError(null);
    try {
      const oldDoc = JSON.parse(oldText);
      const newDoc = JSON.parse(newText);
      setLoading(true);
      setResult(await reviewContracts(oldDoc, newDoc));
      setExpanded({});
    } catch (err) {
      setResult(null);
      setError(err instanceof SyntaxError ? `JSON 解析失败：${err.message}` : (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function loadFile(which: 'old' | 'new') {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        if (which === 'old') setOldText(text);
        else setNewText(text);
      };
      reader.readAsText(file, 'utf-8');
    };
  }

  const operations = useMemo(() => {
    if (!result) return [];
    if (filter === 'all') return result.operations;
    return result.operations
      .map((group) => ({ ...group, findings: group.findings.filter((item) => item.status === filter) }))
      .filter((group) => group.findings.length > 0 || group.status === filter);
  }, [filter, result]);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">离线 OpenAPI 3.0 契约审查</p>
          <h1>新服务替换旧服务时，先定位旧调用会在哪里失败</h1>
          <p className="intro">
            请求检查“旧客户端能发送的值是否仍被接受”；响应检查“新服务是否仍提供旧客户端依赖的保证”。
            外部引用、循环引用和范围外约束列为未知，不会联网补全，也不会掩盖确定的破坏性差异。
          </p>
        </div>
        {result && <StatusBadge status={result.status} large />}
      </header>

      <section className="editor-grid">
        <JsonEditor title="旧 OpenAPI JSON" value={oldText} onChange={setOldText} onFile={loadFile('old')} />
        <JsonEditor title="新 OpenAPI JSON" value={newText} onChange={setNewText} onFile={loadFile('new')} />
      </section>

      <section className="actions">
        <button onClick={runReview} disabled={loading}>{loading ? '审查中…' : '审查契约'}</button>
        <button className="secondary" onClick={() => { setOldText(JSON.stringify(DEMO_OLD, null, 2)); setNewText(JSON.stringify(DEMO_NEW, null, 2)); setResult(null); setError(null); }}>
          载入回归示例
        </button>
        {error && <div className="error">{error}</div>}
      </section>

      {result && (
        <section>
          <div className="result-summary">
            <SummaryCard status="breaking" count={result.summary.breaking} text="确定破坏" />
            <SummaryCard status="unknown" count={result.summary.unknown} text="需要人工确认" />
            <SummaryCard status="compatible" count={result.summary.compatible} text="兼容/新增项" />
          </div>

          <div className="filters" role="tablist" aria-label="结果过滤">
            {(['all', 'breaking', 'unknown', 'compatible'] as const).map((status) => (
              <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
                {status === 'all' ? '全部' : STATUS_LABEL[status]}
              </button>
            ))}
          </div>

          <div className="operation-list">
            {operations.map((operation) => (
              <OperationCard
                key={`${operation.method}-${operation.path}`}
                operation={operation}
                filter={filter}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            ))}
            {operations.length === 0 && <p className="empty">没有匹配的结果。</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function JsonEditor(props: { title: string; value: string; onChange: (value: string) => void; onFile: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <article className="editor">
      <div className="editor-title">
        <h2>{props.title}</h2>
        <label className="file-button">
          选择文件
          <input type="file" accept=".json,application/json" onChange={props.onFile} hidden />
        </label>
      </div>
      <textarea spellCheck={false} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </article>
  );
}

function SummaryCard({ status, count, text }: { status: ReviewStatus; count: number; text: string }) {
  return (
    <div className={`summary-card ${status}`}>
      <strong>{count}</strong>
      <span>{text}</span>
    </div>
  );
}

function OperationCard({ operation, filter, expanded, setExpanded }: {
  operation: OperationGroup;
  filter: ReviewStatus | 'all';
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const findings = filter === 'all' ? operation.findings : operation.findings.filter((item) => item.status === filter);
  return (
    <article className="operation">
      <div className="operation-head">
        <div>
          <span className="method">{operation.method}</span>
          <code>{operation.path}</code>
        </div>
        <StatusBadge status={operation.status} />
      </div>
      <div className="findings">
        {findings.map((finding, index) => {
          const id = `${operation.method}-${operation.path}-${finding.id ?? index}`;
          const open = expanded[id] ?? false;
          return (
            <div key={id} className={`finding ${finding.status}`}>
              <button className="finding-head" onClick={() => setExpanded((current) => ({ ...current, [id]: !open }))}>
                <StatusBadge status={finding.status} />
                <span>{finding.subject}</span>
                <span className="constraint">{finding.constraint}</span>
                <span className="direction">{DIRECTION_LABEL[finding.direction] ?? finding.direction}</span>
                <span className="chevron">{open ? '收起' : '查看'}</span>
              </button>
              {open && <FindingDetail finding={finding} />}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  return (
    <div className="finding-detail">
      <p>{finding.message}</p>
      <div className="detail-grid">
        <LocationList title="旧侧位置" values={finding.oldLocation} chain={finding.referenceChains.old} />
        <LocationList title="新侧位置" values={finding.newLocation} chain={finding.referenceChains.new} />
      </div>
      {finding.sample && (
        <div className="sample">
          <h3>可触发失败的构造</h3>
          {finding.sample.note && <p className="sample-note">{finding.sample.note}</p>}
          {finding.sample.oldRequest !== undefined && finding.sample.oldRequest !== null && (
            <pre>{JSON.stringify(finding.sample.oldRequest, null, 2)}</pre>
          )}
          {finding.sample.newResponse !== undefined && finding.sample.newResponse !== null && (
            <pre>{JSON.stringify(finding.sample.newResponse, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function LocationList({ title, values, chain }: { title: string; values: string[]; chain: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {values.length === 0 && chain.length === 0 ? <p className="muted">无对应位置</p> : (
        <>
          <ol>{values.map((value) => <li key={value}><code>{value}</code></li>)}</ol>
          {chain.length > 0 && (
            <div className="chain">
              <h4>引用链</h4>
              <ol>{chain.map((value) => <li key={value}><code>{value}</code></li>)}</ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, large = false }: { status: ReviewStatus; large?: boolean }) {
  return <span className={`badge ${status} ${large ? 'large' : ''}`}>{STATUS_LABEL[status]}</span>;
}

export default App;
