<script lang="ts">
  import { board } from './lib/store';
  import {
    buildExportRows,
    completionsFor,
    incompleteTasksForDate,
    recordsForDate,
    rowsToCsv,
    shiftDate,
    tasksForDate,
    todayKey,
  } from './lib/logic';
  import { downloadText } from './lib/download';
  import type { CareTask } from './lib/types';
  import CaregiverBar from './components/CaregiverBar.svelte';
  import TaskCard from './components/TaskCard.svelte';
  import CompleteDialog from './components/CompleteDialog.svelte';
  import AddTaskForm from './components/AddTaskForm.svelte';
  import HandoffLog from './components/HandoffLog.svelte';

  let selectedDate = $state(todayKey());
  let incompleteOnly = $state(true);
  let logScope = $state<'day' | 'all'>('day');
  let dialogTask = $state<CareTask | null>(null);
  let toast = $state('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const petById = $derived(new Map($board.pets.map((p) => [p.id, p])));
  const dayTasks = $derived(tasksForDate($board.tasks, selectedDate));
  const pendingTasks = $derived(incompleteTasksForDate($board.tasks, $board.records, selectedDate));
  const visibleTasks = $derived(incompleteOnly ? pendingTasks : dayTasks);

  const groups = $derived.by(() => {
    const map = new Map<string, CareTask[]>();
    for (const t of visibleTasks) {
      const list = map.get(t.petId) ?? [];
      list.push(t);
      map.set(t.petId, list);
    }
    return [...map.entries()];
  });

  const logRecords = $derived(
    logScope === 'day'
      ? recordsForDate($board.records, $board.tasks, selectedDate)
      : [...$board.records].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  );

  const dateLabel = $derived(formatDateLabel(selectedDate));

  function formatDateLabel(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    const week = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
    return `${key} 周${week}`;
  }

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 4500);
  }

  function handleSubmitCompletion(completedBy: string, note: string) {
    const task = dialogTask;
    if (!task) return;
    const { duplicate } = board.confirm(task, completedBy, note);
    dialogTask = null;
    showToast(
      duplicate
        ? `⚠️ 重复确认：「${task.title}」此前已完成，本次记录已标记为重复确认。`
        : `✅ 已完成「${task.title}」`,
    );
  }

  function handleRemove(task: CareTask) {
    if (window.confirm(`删除事项「${task.title}」？相关交接记录也会一并删除。`)) {
      board.removeTask(task.id);
      showToast(`已删除「${task.title}」`);
    }
  }

  function exportName(ext: string): string {
    return `照护交接记录-${logScope === 'day' ? selectedDate : '全部'}.${ext}`;
  }

  function exportJson() {
    const rows = buildExportRows(logRecords, $board.tasks, $board.pets);
    const payload = {
      app: 'pet-care-handoff-board',
      version: 1,
      generatedAt: new Date().toISOString(),
      scope: logScope === 'day' ? selectedDate : 'all',
      records: rows,
    };
    downloadText(exportName('json'), JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    showToast('已导出 JSON 文件');
  }

  function exportCsv() {
    const rows = buildExportRows(logRecords, $board.tasks, $board.pets);
    // 加 BOM 便于 Excel 正确识别中文
    downloadText(exportName('csv'), '\uFEFF' + rowsToCsv(rows), 'text/csv;charset=utf-8');
    showToast('已导出 CSV 文件');
  }

  function resetDemo() {
    if (window.confirm('将清空当前全部数据并恢复虚构示例数据，确定继续吗？')) {
      board.reset();
      selectedDate = todayKey();
      showToast('已恢复虚构示例数据');
    }
  }
</script>

<header class="app-header">
  <div>
    <h1>🐾 宠物照护交接板</h1>
    <p class="subtitle">多人协作照护 · 喂食 / 遛狗 / 清洁 / 用药 · 数据仅保存在本机浏览器</p>
  </div>
  <button class="btn ghost" onclick={resetDemo}>重置示例数据</button>
</header>

<CaregiverBar caregivers={$board.caregivers} onAdd={(name) => board.addCaregiver(name)} />

<section class="date-bar">
  <div class="date-nav">
    <button class="btn ghost" onclick={() => (selectedDate = shiftDate(selectedDate, -1))}>◀ 前一天</button>
    <input type="date" bind:value={selectedDate} aria-label="选择日期" />
    <button class="btn ghost" onclick={() => (selectedDate = shiftDate(selectedDate, 1))}>后一天 ▶</button>
    <button class="btn ghost" onclick={() => (selectedDate = todayKey())}>今天</button>
  </div>
  <div class="date-meta">
    <strong>{dateLabel}</strong>
    <span class="counts">未完成 {pendingTasks.length} / 共 {dayTasks.length} 项</span>
    <label class="filter">
      <input type="checkbox" bind:checked={incompleteOnly} /> 仅看未完成
    </label>
  </div>
</section>

<main>
  {#if groups.length === 0}
    <p class="empty">该日期没有{incompleteOnly ? '未完成的事项，全部搞定' : '安排的事项'} 🎉</p>
  {/if}

  {#each groups as [petId, tasks] (petId)}
    {@const pet = petById.get(petId)}
    <section class="pet-group">
      <h2>
        <span class="avatar">{pet?.avatar}</span> {pet?.name}
        <span class="species">{pet?.species}</span>
      </h2>
      {#if pet?.note}<p class="pet-note">{pet.note}</p>{/if}
      {#each tasks as task (task.id)}
        <TaskCard
          {task}
          completions={completionsFor(task.id, $board.records)}
          onComplete={(t) => (dialogTask = t)}
          onRemove={handleRemove}
        />
      {/each}
    </section>
  {/each}

  <AddTaskForm
    pets={$board.pets}
    defaultDate={selectedDate}
    onAdd={(t) => {
      board.addTask(t);
      showToast(`已安排「${t.title}」`);
    }}
  />

  <HandoffLog
    records={logRecords}
    tasks={$board.tasks}
    pets={$board.pets}
    scope={logScope}
    onScopeChange={(s) => (logScope = s)}
    onExportJson={exportJson}
    onExportCsv={exportCsv}
  />
</main>

{#if dialogTask}
  <CompleteDialog
    task={dialogTask}
    pet={petById.get(dialogTask.petId)}
    existing={completionsFor(dialogTask.id, $board.records)}
    caregivers={$board.caregivers}
    onSubmit={handleSubmitCompletion}
    onClose={() => (dialogTask = null)}
  />
{/if}

{#if toast}
  <div class="toast" role="status">{toast}</div>
{/if}
