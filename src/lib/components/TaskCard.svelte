<script lang="ts">
  import type { CompletionRecord, Pet, TaskInstance } from '../types';
  import { CARE_TYPE_LABELS } from '../types';

  interface Props {
    instance: TaskInstance;
    pet: Pet | undefined;
    records: CompletionRecord[];
    oncomplete: (instance: TaskInstance) => void;
  }

  let { instance, pet, records, oncomplete }: Props = $props();

  const done = $derived(records.length > 0);

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
</script>

<article class="card" class:done>
  <div class="time">{instance.time}</div>
  <div class="body">
    <div class="headline">
      <span class="emoji">{pet?.emoji ?? '🐾'}</span>
      <strong>{instance.title}</strong>
      <span class="pet">{pet?.name ?? instance.petId}</span>
      <span class="badge type-{instance.type}">{CARE_TYPE_LABELS[instance.type]}</span>
      {#if done}
        <span class="badge done-badge">已完成</span>
      {/if}
    </div>
    <p class="instruction">{instance.instruction}</p>
    {#if records.length > 0}
      <ul class="records">
        {#each records as r (r.id)}
          <li>
            <span class="who">{r.completedBy}</span>
            <span class="at">{fmtTime(r.completedAt)}</span>
            {#if r.duplicate}
              <span class="badge dup">重复确认</span>
            {/if}
            {#if r.note}
              <span class="note">“{r.note}”</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <button class="confirm" class:again={done} onclick={() => oncomplete(instance)}>
    {done ? '再次确认' : '确认完成'}
  </button>
</article>

<style>
  .card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: #fff;
    border: 1px solid #e3e0da;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .card.done {
    background: #f6f9f4;
    border-color: #d8e4d0;
  }
  .time {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: #5b5548;
    min-width: 48px;
    padding-top: 2px;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .headline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .pet {
    color: #7a7264;
    font-size: 13px;
  }
  .instruction {
    margin: 6px 0 0;
    color: #6b6355;
    font-size: 13px;
  }
  .badge {
    font-size: 12px;
    border-radius: 999px;
    padding: 1px 8px;
    background: #eee9df;
    color: #5b5548;
  }
  .type-feeding { background: #fde8d7; color: #8a4b12; }
  .type-walking { background: #dcebd8; color: #2f6427; }
  .type-cleaning { background: #dde8f6; color: #2c5282; }
  .type-medication { background: #f6dde3; color: #93324a; }
  .done-badge { background: #cfe3c4; color: #2f6427; }
  .dup { background: #f8e3b0; color: #8a5a00; }
  .records {
    list-style: none;
    margin: 8px 0 0;
    padding: 8px 0 0;
    border-top: 1px dashed #e0dbcf;
    display: grid;
    gap: 4px;
    font-size: 13px;
    color: #5b5548;
  }
  .records li {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .who { font-weight: 600; }
  .at { font-variant-numeric: tabular-nums; color: #8a8172; }
  .note { color: #6b6355; }
  .confirm {
    border: 1px solid #2f6427;
    background: #2f6427;
    color: #fff;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
  }
  .confirm.again {
    background: #fff;
    color: #8a5a00;
    border-color: #d9b25f;
  }
  .confirm:hover { filter: brightness(1.05); }
</style>
