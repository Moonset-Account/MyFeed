"use client";

import type { TaskView } from "@/lib/types";

export default function OverduePanel({
  overdue,
  onSelect,
}: {
  overdue: TaskView[];
  onSelect: (id: string) => void;
}) {
  if (overdue.length === 0) return null;
  return (
    <section className="overdue-panel" aria-label="逾期事项">
      <strong>逾期 {overdue.length} 项，请优先处理：</strong>
      <ul>
        {overdue.map((v) => (
          <li key={v.id}>
            <button onClick={() => onSelect(v.id)}>
              {v.title}
              <span className="overdue-meta">
                截止 {v.dueDate} · {v.owner}
                {v.status === "blocked" ? " · 前置未完成" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
