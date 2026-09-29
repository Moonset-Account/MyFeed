<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CareTaskType, Plant, PlantRecord } from '../types';
  import { formatISODate, todayISODate } from '../dates';
  import { recordsForPlant, taskLabel } from '../care';

  export let plant: Plant;
  export let records: PlantRecord[] = [];
  export let actionDate = todayISODate();

  const dispatch = createEventDispatcher<{
    edit: Plant;
    delete: Plant;
    recordCare: { plant: Plant; taskType: CareTaskType; date: string };
    close: undefined;
  }>();

  $: plantRecords = recordsForPlant(records, plant.id);
</script>

<section class="plant-detail">
  <div class="detail-hero">
    {#if plant.photoDataUrl}
      <img src={plant.photoDataUrl} alt={plant.name} />
    {:else}
      <div class="detail-placeholder">
        <span>照片占位</span>
        <small>编辑植物可添加本地图片</small>
      </div>
    {/if}
    <div>
      <h2>{plant.name}</h2>
      <p class="species">{plant.species || '未填写品种'}</p>
      <dl class="facts">
        <div><dt>光照位置</dt><dd>{plant.lightLocation}</dd></div>
        <div><dt>浇水间隔</dt><dd>每 {plant.waterIntervalDays} 天</dd></div>
        <div><dt>施肥间隔</dt><dd>{plant.fertilizeIntervalDays ? `每 ${plant.fertilizeIntervalDays} 天` : '未设置'}</dd></div>
        <div><dt>换盆间隔</dt><dd>{plant.repotIntervalDays ? `每 ${plant.repotIntervalDays} 天` : '未设置'}</dd></div>
      </dl>
    </div>
  </div>

  {#if plant.notes}
    <p class="notes">{plant.notes}</p>
  {/if}

  <label class="detail-date">
    <span>本次记录日期</span>
    <input type="date" bind:value={actionDate} max={todayISODate()} />
  </label>

  <div class="detail-actions">
    <button type="button" on:click={() => dispatch('recordCare', { plant, taskType: 'water', date: actionDate })}>记录浇水</button>
    <button type="button" class="secondary" on:click={() => dispatch('recordCare', { plant, taskType: 'fertilize', date: actionDate })}>记录施肥</button>
    <button type="button" class="secondary" on:click={() => dispatch('recordCare', { plant, taskType: 'repot', date: actionDate })}>记录换盆</button>
  </div>

  <div class="detail-manage">
    <button type="button" class="ghost" on:click={() => dispatch('edit', plant)}>编辑资料</button>
    <button type="button" class="danger" on:click={() => dispatch('delete', plant)}>删除植物及记录</button>
  </div>

  <h3>养护历史</h3>
  {#if plantRecords.length === 0}
    <p class="muted">还没有实际养护或顺延记录。</p>
  {:else}
    <ul class="history-list">
      {#each plantRecords as record (record.id)}
        <li class={record.kind}>
          <time>{formatISODate(record.date)}</time>
          <div>
            {#if record.kind === 'care'}
              <strong>实际{taskLabel(record.taskType)}</strong>
              {#if record.note}<p>{record.note}</p>{/if}
            {:else}
              <strong>浇水顺延 {record.days} 天</strong>
              <p>{record.reason}{record.resolvedByEventId ? ' · 已由后续实际浇水结清' : ' · 待实际浇水'}</p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
