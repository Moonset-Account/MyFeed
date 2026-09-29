import { describe, expect, it } from "vitest";
import {
  addDays,
  buildTaskViews,
  canComplete,
  computeLayers,
  getBlocked,
  getOverdue,
  progressSummary,
} from "../src/lib/onboarding";
import { ROLES, getRole } from "../src/lib/roles";
import type { RoleTemplate } from "../src/lib/types";

const role: RoleTemplate = {
  id: "test",
  name: "测试角色",
  description: "",
  tasks: [
    { id: "a", title: "A", category: "账号申请", owner: "甲", dueInDays: 1, dependsOn: [], notes: "" },
    { id: "b", title: "B", category: "培训", owner: "乙", dueInDays: 3, dependsOn: ["a"], notes: "" },
    { id: "c", title: "C", category: "实践任务", owner: "丙", dueInDays: 5, dependsOn: ["a", "b"], notes: "" },
  ],
};

describe("addDays", () => {
  it("跨月加天数正确", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-09-29", 0)).toBe("2026-09-29");
  });
});

describe("buildTaskViews", () => {
  const start = "2026-09-01";

  it("前置未完成时任务被阻塞并列出 blockedBy", () => {
    const views = buildTaskViews(role, {}, start, "2026-09-01");
    const b = views.find((v) => v.id === "b")!;
    expect(b.status).toBe("blocked");
    expect(b.blockedBy.map((t) => t.id)).toEqual(["a"]);
    expect(canComplete(b)).toBe(false);
  });

  it("前置全部完成后任务可进行", () => {
    const views = buildTaskViews(role, { a: "2026-09-01T08:00:00Z" }, start, "2026-09-01");
    expect(views.find((v) => v.id === "b")!.status).toBe("available");
    // c 仍被 b 阻塞
    expect(views.find((v) => v.id === "c")!.status).toBe("blocked");
  });

  it("已完成任务状态为 done，且不会被判逾期", () => {
    const views = buildTaskViews(role, { a: "2026-09-01T08:00:00Z" }, start, "2026-09-20");
    expect(views.find((v) => v.id === "a")!.status).toBe("done");
  });

  it("未完成且截止日期早于今天的任务为逾期", () => {
    const views = buildTaskViews(role, {}, start, "2026-09-10");
    expect(views.find((v) => v.id === "a")!.status).toBe("overdue");
    expect(views.find((v) => v.id === "a")!.dueDate).toBe("2026-09-02");
  });
});

describe("getOverdue / getBlocked", () => {
  it("逾期项集中返回，含被阻塞但已逾期的任务", () => {
    const views = buildTaskViews(role, {}, "2026-09-01", "2026-09-10");
    const overdue = getOverdue(views, "2026-09-10").map((v) => v.id);
    expect(overdue).toEqual(["a", "b", "c"]);
    expect(getBlocked(views).map((v) => v.id)).toEqual(["b", "c"]);
  });

  it("今天等于截止日期时不算逾期", () => {
    const views = buildTaskViews(role, {}, "2026-09-01", "2026-09-02");
    expect(getOverdue(views, "2026-09-02")).toEqual([]);
  });
});

describe("computeLayers", () => {
  it("链式依赖按拓扑深度分列", () => {
    const layers = computeLayers(role.tasks);
    expect(layers.get("a")).toBe(0);
    expect(layers.get("b")).toBe(1);
    expect(layers.get("c")).toBe(2);
  });
});

describe("progressSummary", () => {
  it("统计完成数量与百分比", () => {
    const views = buildTaskViews(role, { a: "x", b: "y" }, "2026-09-01", "2026-09-01");
    expect(progressSummary(views)).toEqual({ done: 2, total: 3, percent: 67 });
  });
});

describe("示例角色数据", () => {
  it("每个角色的依赖都指向本角色内存在的任务", () => {
    for (const r of ROLES) {
      const ids = new Set(r.tasks.map((t) => t.id));
      for (const t of r.tasks) {
        for (const dep of t.dependsOn) {
          expect(ids.has(dep), `${r.id}/${t.id} 依赖了不存在的 ${dep}`).toBe(true);
        }
      }
    }
  });

  it("每个任务都有负责人、备注与合理的期限", () => {
    for (const r of ROLES) {
      for (const t of r.tasks) {
        expect(t.owner.length).toBeGreaterThan(0);
        expect(t.notes.length).toBeGreaterThan(0);
        expect(t.dueInDays).toBeGreaterThan(0);
      }
    }
  });

  it("getRole 对未知 id 回退到第一个角色", () => {
    expect(getRole("不存在").id).toBe(ROLES[0].id);
  });
});
