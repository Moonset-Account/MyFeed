import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  completionBlocker,
  computeTasks,
  overdueTasks,
  topoSort,
  validateRole,
  type Role,
} from "../src/lib/onboarding.ts";
import { ROLES } from "../src/lib/roles.ts";

const role: Role = {
  id: "demo",
  name: "示例",
  description: "",
  tasks: [
    { id: "a", title: "申请账号", category: "账号", owner: "IT", note: "", dependsOn: [], dueInDays: 0 },
    { id: "b", title: "领设备", category: "设备", owner: "行政", note: "", dependsOn: [], dueInDays: 1 },
    { id: "c", title: "搭环境", category: "团队", owner: "导师", note: "", dependsOn: ["a", "b"], dueInDays: 3 },
  ],
};

test("示例角色数据：依赖有效且无环", () => {
  for (const r of ROLES) {
    assert.deepEqual(validateRole(r), [], `${r.id} 模板不合法`);
  }
});

test("示例角色均覆盖账号、设备、培训类任务并含备注与负责人", () => {
  for (const r of ROLES) {
    const cats = new Set(r.tasks.map((t) => t.category));
    for (const c of ["账号", "设备", "培训"] as const) {
      assert.ok(cats.has(c), `${r.id} 缺少「${c}」类任务`);
    }
    for (const t of r.tasks) {
      assert.ok(t.owner.length > 0, `${r.id}/${t.id} 缺少负责人`);
      assert.ok(t.note.length > 0, `${r.id}/${t.id} 缺少备注`);
    }
  }
});

test("前置未完成时任务为 blocked，并给出提醒文案", () => {
  const views = computeTasks(role, { startDate: "2026-09-01", completed: {} }, new Date("2026-09-01T09:00:00"));
  const c = views.find((t) => t.id === "c")!;
  assert.equal(c.status, "blocked");
  assert.deepEqual(c.blockedBy, ["申请账号", "领设备"]);
  const msg = completionBlocker(c);
  assert.ok(msg && msg.includes("申请账号") && msg.includes("领设备"));
});

test("前置全部完成后任务变为 available，完成后为 done", () => {
  const state = {
    startDate: "2026-09-01",
    completed: { a: "2026-09-01T02:00:00.000Z", b: "2026-09-01T03:00:00.000Z" },
  };
  let views = computeTasks(role, state, new Date("2026-09-01T09:00:00"));
  const c = views.find((t) => t.id === "c")!;
  assert.equal(c.status, "available");
  assert.equal(completionBlocker(c), null);

  views = computeTasks(
    role,
    { ...state, completed: { ...state.completed, c: "2026-09-02T02:00:00.000Z" } },
    new Date("2026-09-02T09:00:00")
  );
  assert.equal(views.find((t) => t.id === "c")!.status, "done");
});

test("逾期判定：未完成且超过截止日为逾期；逾期项集中列出且不含已完成任务", () => {
  const now = new Date("2026-09-05T09:00:00");
  // a 截止 09-01 未完成 -> 逾期；b 截止 09-02 但 09-01 已完成 -> 不逾期；c 被阻塞且截止 09-04 -> 逾期
  const views = computeTasks(
    role,
    { startDate: "2026-09-01", completed: { b: "2026-09-01T03:00:00.000Z" } },
    now
  );
  assert.equal(views.find((t) => t.id === "a")!.overdue, true);
  assert.equal(views.find((t) => t.id === "b")!.overdue, false);
  assert.equal(views.find((t) => t.id === "c")!.overdue, true);

  const list = overdueTasks(views);
  assert.deepEqual(list.map((t) => t.id), ["a", "c"]); // 按截止日升序，且不含已完成的 b
});

test("截止日当天不算逾期", () => {
  const views = computeTasks(role, { startDate: "2026-09-01", completed: {} }, new Date("2026-09-01T23:59:00"));
  assert.equal(views.find((t) => t.id === "a")!.overdue, false);
});

test("topoSort 保证前置任务排在后续任务之前", () => {
  for (const r of [...ROLES, role]) {
    const order = topoSort(r);
    assert.equal(order.length, r.tasks.length);
    const pos = new Map(order.map((t, i) => [t.id, i]));
    for (const t of r.tasks) {
      for (const dep of t.dependsOn) {
        assert.ok(pos.get(dep)! < pos.get(t.id)!, `${r.id}: ${dep} 应排在 ${t.id} 前`);
      }
    }
  }
});

test("addDays 跨月计算正确", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("validateRole 检出悬空依赖与环", () => {
  const dangling: Role = {
    id: "bad1", name: "", description: "",
    tasks: [{ id: "x", title: "", category: "账号", owner: "", note: "", dependsOn: ["ghost"], dueInDays: 0 }],
  };
  assert.ok(validateRole(dangling).some((e) => e.includes("ghost")));

  const cyclic: Role = {
    id: "bad2", name: "", description: "",
    tasks: [
      { id: "x", title: "", category: "账号", owner: "", note: "", dependsOn: ["y"], dueInDays: 0 },
      { id: "y", title: "", category: "账号", owner: "", note: "", dependsOn: ["x"], dueInDays: 0 },
    ],
  };
  assert.ok(validateRole(cyclic).some((e) => e.includes("环")));
});
