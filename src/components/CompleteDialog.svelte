<script lang="ts">
  import { formatDateTime } from '../lib/logic';
  import type { Caregiver, CareTask, CompletionRecord, Pet } from '../lib/types';

  interface Props {
    task: CareTask;
    pet: Pet | undefined;
    existing: CompletionRecord[];
    caregivers: Caregiver[];
    onSubmit: (completedBy: string, note: string) => void;
    onClose: () => void;
  }
  let { task, pet, existing, caregivers, onSubmit, onClose }: Props = $props();

  let selected = $state('');
  let note = $state('');

  $effect(() => {
    if (!selected && caregivers.length > 0) selected = caregivers[0].name;
  });

  const duplicate = $derived(existing.length > 0);
  const last = $derived(existing[existing.length - 1]);

  function submit() {
    if (!selected) return;
    onSubmit(selected, note);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKey} />

<div
  class="overlay"
  role="presentation"
  onclick={(e) => e.target === e.currentTarget && onClose()}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="确认完成">
    <h3>{duplicate ? '⚠️ 再次确认事项' : '确认完成'}</h3>
    <p class="dialog-task">
      {pet?.avatar} {pet?.name} · {task.date} {task.time} · {task.title}
    </p>

    {#if duplicate && last}
      <div class="dup-warning">
        该事项已被确认过 {existing.length} 次，最近一次由
        <strong>{last.completedBy}</strong> 于 {formatDateTime(last.completedAt)} 完成。
        重复确认会追加一条标记为「重复确认」的交接记录，请与同伴核实后再继续。
      </div>
    {/if}

    <label>
      执行人
      <select bind:value={selected}>
        {#each caregivers as c (c.id)}
          <option value={c.name}>{c.name}</option>
        {/each}
      </select>
    </label>
    <label>
      备注（可选）
      <textarea bind:value={note} rows="2" placeholder="例如：剩了一半饭 / 精神状态不错"></textarea>
    </label>
    <p class="hint">完成时间将记录为当前时间。</p>

    <div class="dialog-actions">
      <button class="btn ghost" onclick={onClose}>取消</button>
      <button class="btn" class:danger={duplicate} class:primary={!duplicate} onclick={submit} disabled={!selected}>
        {duplicate ? '仍然确认（重复）' : '确认完成'}
      </button>
    </div>
  </div>
</div>
