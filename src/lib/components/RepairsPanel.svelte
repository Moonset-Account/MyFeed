<script lang="ts">
  import { appState } from '../store';
  import { resolveRepair, uid } from '../logic';
  import type { RepairTask } from '../types';

  let manualTitle = $state('');
  let fixQty: Record<string, number> = $state({});

  function gearName(id: string | null): string {
    if (!id) return '';
    return $appState.gear.find((g) => g.id === id)?.name ?? '（装备已删除）';
  }

  function damagedOf(id: string | null): number {
    if (!id) return 0;
    return $appState.gear.find((g) => g.id === id)?.damaged ?? 0;
  }

  function addManual() {
    const title = manualTitle.trim();
    if (!title) return;
    const task: RepairTask = {
      id: uid(),
      gearId: null,
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    appState.update((s) => ({ ...s, repairs: [...s.repairs, task] }));
    manualTitle = '';
  }

  function complete(task: RepairTask) {
    const qty = fixQty[task.id] ?? damagedOf(task.gearId);
    appState.update((s) => ({
      ...s,
      gear: resolveRepair(task, s.gear, qty),
      repairs: s.repairs.map((r) => (r.id === task.id ? { ...r, done: true } : r)),
    }));
  }

  function toggle(task: RepairTask) {
    appState.update((s) => ({
      ...s,
      repairs: s.repairs.map((r) => (r.id === task.id ? { ...r, done: !r.done } : r)),
    }));
  }

  function remove(id: string) {
    appState.update((s) => ({ ...s, repairs: s.repairs.filter((r) => r.id !== id) }));
  }

  const open = $derived($appState.repairs.filter((r) => !r.done));
  const done = $derived($appState.repairs.filter((r) => r.done));
</script>

<div class="card">
  <h2>添加维修待办</h2>
  <div class="row">
    <input placeholder="如：炉头点火器失灵，买替换件" bind:value={manualTitle} style="min-width: 280px;" />
    <button class="primary" onclick={addManual} disabled={!manualTitle.trim()}>添加</button>
  </div>
  <p class="muted">装备库中标记的损坏、以及归来检查登记的新增损坏，也会自动出现在这里。</p>
</div>

{#if open.length === 0}
  <p class="muted">没有待办的维修，装备状态良好。</p>
{/if}

{#each open as task (task.id)}
  <div class="card">
    <div class="row" style="justify-content: space-between;">
      <div>
        <strong>{task.title}</strong>
        {#if task.gearId}
          <div class="muted">关联装备：{gearName(task.gearId)}，当前损坏 {damagedOf(task.gearId)} 件</div>
        {/if}
      </div>
      <div class="row">
        {#if task.gearId && damagedOf(task.gearId) > 0}
          <label class="muted">
            修好
            <input
              type="number"
              min="1"
              max={damagedOf(task.gearId)}
              value={fixQty[task.id] ?? damagedOf(task.gearId)}
              onchange={(e) => (fixQty[task.id] = Math.max(1, Number(e.currentTarget.value) || 1))}
            />
            件
          </label>
        {/if}
        <button class="primary small" onclick={() => complete(task)}>完成维修</button>
        <button class="small danger" onclick={() => remove(task.id)}>删除</button>
      </div>
    </div>
  </div>
{/each}

{#if done.length > 0}
  <div class="card">
    <h3>已完成</h3>
    {#each done as task (task.id)}
      <div class="row" style="justify-content: space-between; padding: 4px 0;">
        <span class="muted"><s>{task.title}</s></span>
        <span class="row">
          <button class="small" onclick={() => toggle(task)}>重新打开</button>
          <button class="small danger" onclick={() => remove(task.id)}>删除</button>
        </span>
      </div>
    {/each}
  </div>
{/if}
