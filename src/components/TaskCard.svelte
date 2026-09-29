<script lang="ts">
  import { CATEGORY_META, formatDateTime } from '../lib/logic';
  import type { CareTask, CompletionRecord } from '../lib/types';

  interface Props {
    task: CareTask;
    completions: CompletionRecord[];
    onComplete: (task: CareTask) => void;
    onRemove: (task: CareTask) => void;
  }
  let { task, completions, onComplete, onRemove }: Props = $props();

  const meta = $derived(CATEGORY_META[task.category]);
  const done = $derived(completions.length > 0);
  const last = $derived(completions[completions.length - 1]);
</script>

<article class="task-card" class:done>
  <div class="task-time">{task.time}</div>
  <div class="task-main">
    <div class="task-title-row">
      <span class="cat">{meta.icon} {meta.label}</span>
      <strong>{task.title}</strong>
    </div>
    {#if task.detail}<p class="detail">{task.detail}</p>{/if}
    {#if done && last}
      <div class="completion">
        <span>✅ {last.completedBy} · {formatDateTime(last.completedAt)}</span>
        {#if completions.length > 1}
          <span class="dup-badge">已确认 {completions.length} 次</span>
        {/if}
        {#if last.note}<span class="note">备注：{last.note}</span>{/if}
      </div>
    {/if}
  </div>
  <div class="task-actions">
    {#if done}
      <button class="btn ghost warn" onclick={() => onComplete(task)}>再次确认</button>
    {:else}
      <button class="btn primary" onclick={() => onComplete(task)}>确认完成</button>
      <button class="btn icon" title="删除该事项" onclick={() => onRemove(task)}>✕</button>
    {/if}
  </div>
</article>
