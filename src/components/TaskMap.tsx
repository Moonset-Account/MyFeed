"use client";

import { useMemo } from "react";
import type { TaskView } from "@/lib/types";
import { computeLayers } from "@/lib/onboarding";

const NODE_W = 200;
const NODE_H = 64;
const COL_GAP = 90;
const ROW_GAP = 22;
const PAD = 24;

const STATUS_STYLE: Record<
  TaskView["status"],
  { stroke: string; fill: string; label: string }
> = {
  done: { stroke: "#16a34a", fill: "#f0fdf4", label: "已完成" },
  blocked: { stroke: "#d97706", fill: "#fffbeb", label: "待前置" },
  overdue: { stroke: "#dc2626", fill: "#fef2f2", label: "已逾期" },
  available: { stroke: "#2563eb", fill: "#eff6ff", label: "可进行" },
};

interface Positioned {
  view: TaskView;
  x: number;
  y: number;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function TaskMap({
  views,
  selectedId,
  onSelect,
}: {
  views: TaskView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { nodes, edges, width, height } = useMemo(() => {
    const layers = computeLayers(views);
    const columns = new Map<number, TaskView[]>();
    for (const v of views) {
      const layer = layers.get(v.id) ?? 0;
      const list = columns.get(layer) ?? [];
      list.push(v);
      columns.set(layer, list);
    }
    const maxLayer = Math.max(0, ...columns.keys());
    const nodes: Positioned[] = [];
    for (let layer = 0; layer <= maxLayer; layer++) {
      const list = columns.get(layer) ?? [];
      list.forEach((view, row) => {
        nodes.push({
          view,
          x: PAD + layer * (NODE_W + COL_GAP),
          y: PAD + row * (NODE_H + ROW_GAP),
        });
      });
    }
    const posById = new Map(nodes.map((n) => [n.view.id, n]));
    const edges: { from: Positioned; to: Positioned; done: boolean }[] = [];
    for (const n of nodes) {
      for (const depId of n.view.dependsOn) {
        const from = posById.get(depId);
        if (from) {
          edges.push({ from, to: n, done: from.view.status === "done" });
        }
      }
    }
    const maxRows = Math.max(1, ...[...columns.values()].map((l) => l.length));
    return {
      nodes,
      edges,
      width: PAD * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP,
      height: PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP,
    };
  }, [views]);

  return (
    <div className="map-scroll" aria-label="入职任务依赖地图">
      <svg width={width} height={height} role="list">
        {edges.map((e, i) => {
          const x1 = e.from.x + NODE_W;
          const y1 = e.from.y + NODE_H / 2;
          const x2 = e.to.x;
          const y2 = e.to.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={e.done ? "#16a34a" : "#94a3b8"}
              strokeWidth={2}
              strokeDasharray={e.done ? undefined : "5 4"}
            />
          );
        })}
        {nodes.map((n) => {
          const style = STATUS_STYLE[n.view.status];
          const selected = n.view.id === selectedId;
          return (
            <g
              key={n.view.id}
              role="listitem"
              tabIndex={0}
              aria-label={`${n.view.title}，${style.label}`}
              onClick={() => onSelect(n.view.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.view.id);
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={selected ? 3 : 1.5}
              />
              <text x={n.x + 12} y={n.y + 24} fontSize={13} fontWeight={600} fill="#0f172a">
                {truncate(n.view.title, 12)}
                <title>{n.view.title}</title>
              </text>
              <text x={n.x + 12} y={n.y + 43} fontSize={11} fill="#475569">
                {truncate(n.view.owner, 12)}
              </text>
              <text x={n.x + NODE_W - 12} y={n.y + 43} fontSize={11} textAnchor="end" fill={style.stroke}>
                {style.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
