<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { waterDueDate, diffDays, todayStr, addDays } from '../lib/care';
  import { CARE_LABELS, LIGHT_LABELS, type CareType, type Plant } from '../lib/types';

  let { plant, onClose, onEdit }: { plant: Plant; onClose: () => void; onEdit: () => void } = $props();

  const today = todayStr();
  let careDate = $state(today);
  let note = $state('');
  let postponeDays = $state(1);
  let postponeReason = $state('连续阴雨');
  let confirmDelete = $state(false);

  const plantEvents = $derived(
    store.events
      .filter((e) => e.plantId === plant.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  );
  const plantPostponements = $derived(
    store.postponements
      .filter((p) => p.plantId === plant.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  );
  const due = $derived(waterDueDate(plant, store.events, store.postponements));
  const dueDays = $derived(diffDays(due, today));

  function record(type: CareType) {
    store.addEvent(plant.id, type, careDate || today, note.trim());
    note = '';
  }

  function postpone() {
    store.postpone(plant.id, postponeDays, postponeReason.trim() || '连续阴雨');
  }
</script>

<div class="mask" role="presentation" onclick={onClose} onkeydown={(e) => e.key === "Escape" && onClose()}>
  <div class="dialog" role="dialog" tabindex="-1" aria-label="植物详情" onclick={(e) => e.stopPropagation()}>
    <header>
      <div class="photo"><span>{plant.icon}</span></div>
      <div>
        <h2>{plant.name}</h2>
        <p class="muted">{plant.species || '未填写品种'} · {LIGHT_LABELS[plant.light]}</p>
        <p class="muted">
          浇水每 {plant.waterIntervalDays} 天
          {#if plant.fertilizeIntervalDays} · 施肥每 {plant.fertilizeIntervalDays} 天{/if}
        </p>
        <p class="due" class:late={dueDays < 0}>
          下次浇水：{due}
          {dueDays < 0 ? `（已逾期 ${-dueDays} 天）` : dueDays === 0 ? '（今天）' : `（${dueDays} 天后）`}
        </p>
      </div>
      <button class="close" onclick={onClose}>✕</button>
    </header>

    <section class="block">
      <h3>记录养护（按实际日期生成下次待办）</h3>
      <div class="row">
        <input type="date" bind:value={careDate} max={today} />
        <input placeholder="备注（选填）" bind:value={note} />
      </div>
      <div class="row btns">
        <button class="primary" onclick={() => record('water')}>💧 浇水完成</button>
        <button onclick={() => record('fertilize')}>🧪 施肥完成</button>
        <button onclick={() => record('repot')}>🪴 记录换盆</button>
      </div>
    </section>

    <section class="block">
      <h3>连续阴雨顺延浇水</h3>
      <p class="muted">顺延只推迟待办，不算完成浇水；天气放晴后仍需补浇。</p>
      <div class="row">
        <select bind:value={postponeDays}>
          {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
            <option value={d}>顺延 {d} 天</option>
          {/each}
        </select>
        <input bind:value={postponeReason} placeholder="原因" />
        <button onclick={postpone}>顺延</button>
      </div>
    </section>

    <section class="block">
      <h3>养护记录（{plantEvents.length}）</h3>
      {#if plantEvents.length === 0}
        <p class="muted">还没有记录。</p>
      {:else}
        <ul>
          {#each plantEvents as e (e.id)}
            <li>
              <span class="date">{e.date}</span>
              <span class="badge">{CARE_LABELS[e.type]}</span>
              {#if e.note}<span class="muted">{e.note}</span>{/if}
              <button class="small danger del" onclick={() => store.removeEvent(e.id)}>删除</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if plantPostponements.length > 0}
        <h3>顺延记录（未完成浇水）</h3>
        <ul>
          {#each plantPostponements as p (p.id)}
            <li>
              <span class="date">{p.createdAt}</span>
              <span class="badge warn">顺延 {p.days} 天</span>
              <span class="muted">{p.reason}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <footer class="row">
      <button onclick={onEdit}>编辑资料</button>
      {#if confirmDelete}
        <button class="danger" onclick={() => { store.removePlant(plant.id); onClose(); }}>
          确认删除（含全部记录）
        </button>
      {:else}
        <button class="danger" onclick={() => (confirmDelete = true)}>删除植物</button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .mask {
    position: fixed;
    inset: 0;
    background: rgba(20, 30, 24, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 10;
  }
  .dialog {
    background: var(--panel);
    border-radius: 16px;
    padding: 22px;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow: auto;
  }
  header { display: flex; gap: 14px; align-items: flex-start; }
  .photo {
    width: 72px;
    height: 72px;
    flex: none;
    border-radius: 14px;
    border: 1px dashed var(--accent);
    background: linear-gradient(135deg, #e8f3ea, #d3e8d8);
    font-size: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h2 { margin: 0 0 4px; font-size: 20px; }
  .muted { color: var(--muted); font-size: 13px; margin: 2px 0; }
  .due { color: var(--accent); font-size: 14px; margin: 6px 0 0; }
  .due.late { color: var(--warn); font-weight: 600; }
  .close { margin-left: auto; border: none; background: none; font-size: 16px; }
  .block { border-top: 1px solid var(--line); margin-top: 16px; padding-top: 14px; }
  h3 { font-size: 14px; margin: 0 0 10px; }
  .row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  .btns { flex-wrap: wrap; }
  ul { list-style: none; margin: 0 0 10px; padding: 0; }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px dashed var(--line);
    font-size: 14px;
  }
  li:first-child { border-top: none; }
  .date { color: var(--muted); font-variant-numeric: tabular-nums; }
  .del { margin-left: auto; }
  footer { margin-top: 12px; }
</style>
