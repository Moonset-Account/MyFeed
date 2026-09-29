<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CareTodo } from '../types';
  import { addDays, formatISODate, todayISODate } from '../dates';

  export let todo: CareTodo;

  const dispatch = createEventDispatcher<{
    submit: { todo: CareTodo; days: number; date: string; reason: string };
    cancel: undefined;
  }>();

  let days = 1;
  let date = todayISODate();
  let reason = '连续阴雨';
  let error = '';

  function submit(): void {
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      error = '请输入 1 到 30 天。';
      return;
    }
    dispatch('submit', { todo, days, date, reason });
  }
</script>

<form class="postpone-form" on:submit|preventDefault={submit}>
  <p class="dialog-intro">
    顺延只会移动 {todo.plantName} 的浇水提醒，不会写入“已浇水”记录。当前截止日期：
    <strong>{formatISODate(todo.dueDate)}</strong>
  </p>

  <label>
    <span>顺延日期</span>
    <input bind:value={date} type="date" max={todayISODate()} />
  </label>

  <label>
    <span>顺延天数</span>
    <input bind:value={days} type="number" min="1" max="30" required />
  </label>

  <label>
    <span>原因</span>
    <input bind:value={reason} maxlength="60" placeholder="连续阴雨" />
  </label>

  <p class="projected-date">顺延后截止日期：{formatISODate(addDays(todo.dueDate, days))}</p>
  {#if error}<p class="error">{error}</p>{/if}

  <div class="modal-actions">
    <button type="button" class="ghost" on:click={() => dispatch('cancel')}>取消</button>
    <button type="submit">确认顺延</button>
  </div>
</form>
