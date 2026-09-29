<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CareTodo, Postponement } from '../types';
  import { formatISODate, relativeDayLabel } from '../dates';

  export let todos: CareTodo[] = [];
  export let postponementsByPlant: Record<string, Postponement[]> = {};

  const dispatch = createEventDispatcher<{
    complete: { todo: CareTodo };
    postpone: { todo: CareTodo };
    cancelPostponement: { recordId: string };
  }>();

  const statusText = {
    overdue: '逾期',
    today: '今天',
    upcoming: '待办'
  };
</script>

<section class="todo-panel" aria-label="本地提醒列表">
  <div class="section-heading">
    <div>
      <p class="eyebrow">本地提醒</p>
      <h2>今日与后续养护</h2>
    </div>
    <span class="todo-count">{todos.length} 项</span>
  </div>

  {#if todos.length === 0}
    <div class="empty-box">
      <strong>暂无提醒</strong>
      <p>添加第一盆植物后，这里会按间隔自动生成浇水、施肥和换盆待办。</p>
    </div>
  {:else}
    <ul class="todo-list">
      {#each todos as todo (todo.id)}
        {@const activePostponements = todo.taskType === 'water' ? postponementsByPlant[todo.plantId] ?? [] : []}
        <li class={`todo-item ${todo.status}`}>
          <div class="todo-main">
            <div class="todo-title-row">
              <span class={`status-pill ${todo.status}`}>{statusText[todo.status]}</span>
              <strong>{todo.plantName} · {todo.title}</strong>
            </div>
            <p>
              计划日期：{formatISODate(todo.dueDate)}（{relativeDayLabel(todo.daysFromToday)}） ·
              每 {todo.intervalDays} 天
              {#if todo.lastCareDate}
                · 上次实际{todo.title}：{formatISODate(todo.lastCareDate)}
              {:else}
                · 尚未记录实际{todo.title}
              {/if}
            </p>
            {#if activePostponements.length > 0}
              <div class="postponement-strip">
                {#each activePostponements as postponement (postponement.id)}
                  <span>
                    {formatISODate(postponement.date)} 顺延 {postponement.days} 天：{postponement.reason}
                    <button
                      type="button"
                      on:click={() => dispatch('cancelPostponement', { recordId: postponement.id })}
                    >
                      撤销
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="todo-actions">
            {#if todo.taskType === 'water'}
              <button class="secondary" type="button" on:click={() => dispatch('postpone', { todo })}>
                阴雨顺延
              </button>
            {/if}
            <button type="button" on:click={() => dispatch('complete', { todo })}>
              已实际{todo.title}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
