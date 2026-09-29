<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CareTodo, Plant } from '../types';
  import { formatISODate, relativeDayLabel } from '../dates';

  export let plant: Plant;
  export let todos: CareTodo[] = [];

  const dispatch = createEventDispatcher<{
    open: string;
    edit: Plant;
    quickWater: Plant;
  }>();

  $: waterTodo = todos.find((todo) => todo.plantId === plant.id && todo.taskType === 'water');
  $: urgentTodos = todos.filter((todo) => todo.plantId === plant.id);
</script>

<article class="plant-card">
  <div class="card-photo">
    {#if plant.photoDataUrl}
      <img src={plant.photoDataUrl} alt={plant.name} />
    {:else}
      <div class="plant-placeholder">
        <span>盆栽</span>
        <small>{plant.lightLocation}</small>
      </div>
    {/if}
  </div>
  <div class="card-body">
    <div class="card-title">
      <div>
        <h3>{plant.name}</h3>
        <p>{plant.species || '未填写品种'}</p>
      </div>
      <span class="light-tag">{plant.lightLocation}</span>
    </div>

    {#if waterTodo}
      <p class={`next-care ${waterTodo.status}`}>
        下次浇水：{formatISODate(waterTodo.dueDate)} · {relativeDayLabel(waterTodo.daysFromToday)}
        {#if waterTodo.postponedDays > 0}（已顺延 {waterTodo.postponedDays} 天）{/if}
      </p>
    {/if}

    <div class="card-summary">
      <span>{urgentTodos.length} 项排期待办</span>
      <span>每 {plant.waterIntervalDays} 天浇水</span>
    </div>

    <div class="card-actions" role="group" aria-label={`${plant.name}操作`}>
      <button type="button" class="ghost" on:click={() => dispatch('open', plant.id)}>详情</button>
      <button type="button" class="ghost" on:click={() => dispatch('edit', plant)}>编辑</button>
      <button type="button" on:click={() => dispatch('quickWater', plant)}>记录浇水</button>
    </div>
  </div>
</article>
