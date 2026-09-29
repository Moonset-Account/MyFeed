<script lang="ts">
  import { actions } from '../lib/store';
  import type { Gear, RepairTodo } from '../lib/types';

  let { gears, repairTodos }: { gears: Gear[]; repairTodos: RepairTodo[] } = $props();

  let gearId = $state('');
  let quantity = $state(1);
  let note = $state('');

  const damagedGears = $derived(gears.filter((gear) => gear.damaged > 0));
  const selectedGear = $derived(damagedGears.find((gear) => gear.id === gearId) ?? damagedGears[0]);
  $effect(() => {
    if (!selectedGear || gearId === selectedGear.id) return;
    gearId = selectedGear.id;
  });

  const activeTodos = $derived(repairTodos.filter((todo) => !todo.resolved));
  const resolvedTodos = $derived(repairTodos.filter((todo) => todo.resolved));

  function gearName(id: string): string {
    return gears.find((gear) => gear.id === id)?.name ?? '已删除装备';
  }

  function addTodo() {
    if (!gearId) return;
    actions.addRepairTodo({ gearId: selectedGear?.id ?? gearId, quantity, note });
    note = '';
  }
</script>

<section class="panel">
  <div class="panel-heading">
    <div>
      <p class="eyebrow">Repairs</p>
      <h2>维修待办</h2>
    </div>
    <p class="muted">归来发现的损坏会自动进入待办；完成维修后，库存损坏数会同步减少。</p>
  </div>

  <form class="repair-create" onsubmit={(event) => { event.preventDefault(); addTodo(); }}>
    <label>
      损坏装备
      <select bind:value={gearId}>
        {#each damagedGears as gear (gear.id)}
          <option value={gear.id}>{gear.name}（损坏 {gear.damaged}）</option>
        {/each}
      </select>
    </label>
    <label>
      数量
      <input type="number" min="1" max={selectedGear?.damaged ?? 1} bind:value={quantity} />
    </label>
    <label class="wide">
      问题/处理备注
      <input bind:value={note} maxlength="120" placeholder="例如：帐杆开裂，需要补配件" />
    </label>
    <button class="primary" type="submit" disabled={!selectedGear}>新增待办</button>
  </form>

  {#if activeTodos.length === 0}
    <div class="empty-state">没有未完成维修。</div>
  {:else}
    <div class="todo-list">
      {#each activeTodos as todo (todo.id)}
        <article class="todo-card">
          <div>
            <h3>{gearName(todo.gearId)} <span>× {todo.quantity}</span></h3>
            <p>{todo.note}</p>
            <small>{new Date(todo.createdAt).toLocaleString('zh-CN')}</small>
          </div>
          <div class="card-actions">
            <button type="button" class="primary" onclick={() => actions.resolveRepairTodo(todo.id)}>已修好</button>
            <button type="button" onclick={() => actions.deleteRepairTodo(todo.id)}>删除</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if resolvedTodos.length > 0}
    <h3 class="section-title">已处理</h3>
    <div class="todo-list compact">
      {#each resolvedTodos as todo (todo.id)}
        <article class="todo-card resolved">
          <div>
            <h3>{gearName(todo.gearId)} <span>× {todo.quantity}</span></h3>
            <p>{todo.note}</p>
          </div>
          <div class="card-actions">
            <button type="button" onclick={() => actions.reopenRepairTodo(todo.id)}>撤销</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>
