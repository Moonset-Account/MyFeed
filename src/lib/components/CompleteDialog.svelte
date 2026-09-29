<script lang="ts">
  import { untrack } from 'svelte';
  import type { CompletionRecord, TaskInstance } from '../types';

  interface Props {
    instance: TaskInstance;
    petName: string;
    existing: CompletionRecord[];
    caregivers: string[];
    onconfirm: (completedBy: string, note: string) => void;
    oncancel: () => void;
  }

  let { instance, petName, existing, caregivers, onconfirm, oncancel }: Props = $props();

  // 弹窗每次打开时重建，这里只需要照护人列表的当前首个值作为默认执行人
  let completedBy = $state(untrack(() => caregivers[0] ?? ''));
  let note = $state('');

  const isDuplicate = $derived(existing.length > 0);
  const last = $derived(existing.length > 0 ? existing[existing.length - 1] : undefined);

  function fmtLast(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function submit() {
    if (!completedBy) return;
    onconfirm(completedBy, note);
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') oncancel();
  }}
/>

<div class="overlay-root">
  <button class="backdrop" aria-label="关闭对话框" onclick={oncancel}></button>
  <div class="dialog" role="dialog" aria-modal="true" aria-label="确认完成">
    <h3>确认完成 · {instance.title}</h3>
    <p class="meta">{petName} · 计划 {instance.time}</p>

    {#if isDuplicate && last}
      <div class="warning" role="alert">
        ⚠️ 该事项今天已由 <strong>{last.completedBy}</strong> 于 {fmtLast(last.completedAt)}
        确认完成{#if existing.length > 1}（共 {existing.length} 次）{/if}。
        请与同伴核对，避免重复{instance.type === 'medication' ? '用药' : '操作'}；确实需要可再次记录。
      </div>
    {/if}

    <label>
      执行人
      <select bind:value={completedBy}>
        {#each caregivers as c (c)}
          <option value={c}>{c}</option>
        {/each}
      </select>
    </label>

    <label>
      备注（可选）
      <textarea bind:value={note} rows="3" placeholder="例如：食量正常、精神状态、异常情况……"></textarea>
    </label>

    <div class="actions">
      <button class="ghost" onclick={oncancel}>取消</button>
      <button class="primary" class:warn={isDuplicate} onclick={submit} disabled={!completedBy}>
        {isDuplicate ? '仍要再次记录' : '确认完成'}
      </button>
    </div>
  </div>
</div>

<style>
  .overlay-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 10;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(30, 27, 20, 0.45);
    cursor: default;
  }
  .dialog {
    position: relative;
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    width: min(440px, 100%);
    display: grid;
    gap: 12px;
  }
  h3 { margin: 0; }
  .meta { margin: 0; color: #7a7264; font-size: 13px; }
  .warning {
    background: #fdf3d7;
    border: 1px solid #e8c96a;
    color: #7a5200;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.5;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: #5b5548;
  }
  select, textarea {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid #d5cfc2;
    border-radius: 8px;
    background: #fff;
  }
  textarea { resize: vertical; }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  button {
    font: inherit;
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
  }
  .ghost {
    background: #fff;
    border: 1px solid #d5cfc2;
    color: #5b5548;
  }
  .primary {
    background: #2f6427;
    border: 1px solid #2f6427;
    color: #fff;
  }
  .primary.warn {
    background: #b26a00;
    border-color: #b26a00;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
