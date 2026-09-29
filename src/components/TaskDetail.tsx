"use client";

import type { TaskView } from "@/lib/types";
import { canComplete } from "@/lib/onboarding";

const STATUS_LABEL: Record<TaskView["status"], string> = {
  done: "已完成",
  blocked: "等待前置事项",
  overdue: "已逾期",
  available: "可以开始",
};

export default function TaskDetail({
  view,
  warning,
  onComplete,
  onUndo,
}: {
  view: TaskView | null;
  warning: string | null;
  onComplete: (view: TaskView) => void;
  onUndo: (view: TaskView) => void;
}) {
  if (!view) {
    return (
      <aside className="detail detail-empty">
        <p>点击左侧地图中的任务，查看负责人、备注与前置事项。</p>
      </aside>
    );
  }

  const blocked = !canComplete(view);

  return (
    <aside className="detail" aria-label="任务详情">
      <div className="detail-head">
        <span className={`badge badge-${view.status}`}>{STATUS_LABEL[view.status]}</span>
        <span className="badge badge-category">{view.category}</span>
      </div>
      <h2>{view.title}</h2>
      <dl>
        <div>
          <dt>负责人</dt>
          <dd>{view.owner}</dd>
        </div>
        <div>
          <dt>截止日期</dt>
          <dd>
            {view.dueDate}（入职第 {view.dueInDays} 天）
          </dd>
        </div>
        {view.completedAt && (
          <div>
            <dt>完成时间</dt>
            <dd>{new Date(view.completedAt).toLocaleString("zh-CN")}</dd>
          </div>
        )}
        <div>
          <dt>备注</dt>
          <dd>{view.notes}</dd>
        </div>
        <div>
          <dt>前置事项</dt>
          <dd>
            {view.dependsOn.length === 0 && "无"}
            {view.blockedBy.length > 0 && (
              <ul className="blocked-list">
                {view.blockedBy.map((t) => (
                  <li key={t.id}>未完成：{t.title}</li>
                ))}
              </ul>
            )}
            {view.dependsOn.length > 0 && view.blockedBy.length === 0 && "全部已完成"}
          </dd>
        </div>
      </dl>

      {warning && <p className="warning">{warning}</p>}

      {view.status === "done" ? (
        <button className="btn btn-secondary" onClick={() => onUndo(view)}>
          撤销完成
        </button>
      ) : (
        <button
          className="btn btn-primary"
          disabled={blocked}
          title={blocked ? "前置事项未完成，暂不能标记完成" : undefined}
          onClick={() => onComplete(view)}
        >
          标记完成
        </button>
      )}
      {blocked && (
        <p className="hint">请先完成上方列出的前置事项，再标记本任务完成。</p>
      )}
    </aside>
  );
}
