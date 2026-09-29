<script lang="ts">
  import { draggedGuestId } from '../lib/dnd';
  import { unseated } from '../lib/rules';
  import { addGuest, removeGuest, appState, unassign, updateGuest } from '../lib/store';
  import type { Guest } from '../lib/types';

  let newName = '';
  let expandedId: string | null = null;

  $: guests = $appState.guests;
  $: unseatedList = unseated($appState);
  $: seatedCount = guests.length - unseatedList.length;

  function submit() {
    addGuest(newName);
    newName = '';
  }

  function toggleRelation(g: Guest, key: 'together' | 'avoid', otherId: string) {
    const list = g[key].includes(otherId)
      ? g[key].filter((x) => x !== otherId)
      : [...g[key], otherId];
    updateGuest(g.id, { [key]: list });
  }

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    draggedGuestId.set(id);
  }

  function onDropUnassigned(e: DragEvent) {
    e.preventDefault();
    const id = $draggedGuestId ?? e.dataTransfer?.getData('text/plain');
    if (id) unassign(id);
    draggedGuestId.set(null);
  }
</script>

<section class="panel">
  <h2>宾客名单（{guests.length} 人，已入座 {seatedCount} 人）</h2>

  <form class="add" on:submit|preventDefault={submit}>
    <input
      placeholder="输入宾客姓名"
      bind:value={newName}
      aria-label="宾客姓名"
    />
    <button type="submit" class="primary" disabled={!newName.trim()}>添加</button>
  </form>

  {#if guests.length === 0}
    <p class="hint">还没有宾客，先添加几位吧。</p>
  {/if}

  <ul class="guest-list">
    {#each guests as g (g.id)}
      <li>
        <div class="row">
          <span
            class="chip"
            draggable="true"
            role="button"
            tabindex="0"
            on:dragstart={(e) => onDragStart(e, g.id)}
            on:dragend={() => draggedGuestId.set(null)}
            title="拖动到座位入座"
          >
            {#if g.needsAccessible}<span class="wheelchair">♿</span>{/if}
            {g.name}
          </span>
          <button class="link" on:click={() => (expandedId = expandedId === g.id ? null : g.id)}>
            {expandedId === g.id ? '收起' : '关系/需求'}
          </button>
          <button class="link danger" on:click={() => removeGuest(g.id)}>删除</button>
        </div>

        {#if expandedId === g.id}
          <div class="editor">
            <label class="check">
              <input
                type="checkbox"
                checked={g.needsAccessible}
                on:change={(e) => updateGuest(g.id, { needsAccessible: e.currentTarget.checked })}
              />
              需要无障碍座位
            </label>
            {#if guests.length > 1}
              <div class="rel">
                <span>同行：</span>
                {#each guests.filter((x) => x.id !== g.id) as other (other.id)}
                  <label class="check">
                    <input
                      type="checkbox"
                      checked={g.together.includes(other.id)}
                      on:change={() => toggleRelation(g, 'together', other.id)}
                    />
                    {other.name}
                  </label>
                {:else}
                  <span class="hint">无其他宾客</span>
                {/each}
              </div>
              <div class="rel">
                <span>避开：</span>
                {#each guests.filter((x) => x.id !== g.id) as other (other.id)}
                  <label class="check">
                    <input
                      type="checkbox"
                      checked={g.avoid.includes(other.id)}
                      on:change={() => toggleRelation(g, 'avoid', other.id)}
                    />
                    {other.name}
                  </label>
                {/each}
              </div>
            {:else}
              <p class="hint">再添加宾客后，可在此设置同行与需避开关系。</p>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  <div
    class="unassigned"
    class:drag-over={$draggedGuestId !== null}
    on:dragover|preventDefault
    on:drop={onDropUnassigned}
    role="region"
    aria-label="未安排名单"
  >
    <h3>未安排名单（{unseatedList.length} 人）</h3>
    {#if unseatedList.length === 0}
      <p class="hint">全部宾客均已入座。把座位上的宾客拖到这里可取消安排。</p>
    {:else}
      <div class="chips">
        {#each unseatedList as g (g.id)}
          <span
            class="chip"
            draggable="true"
            role="button"
            tabindex="0"
            on:dragstart={(e) => onDragStart(e, g.id)}
            on:dragend={() => draggedGuestId.set(null)}
          >
            {#if g.needsAccessible}<span class="wheelchair">♿</span>{/if}
            {g.name}
          </span>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 16px;
  }
  h2 { font-size: 16px; margin: 0 0 12px; }
  h3 { font-size: 14px; margin: 0 0 8px; }
  .add { display: flex; gap: 8px; margin-bottom: 12px; }
  .add input { flex: 1; }
  .hint { font-size: 12px; color: var(--muted); margin: 4px 0; }
  .guest-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; }
  .guest-list li { border-bottom: 1px solid var(--line); padding: 6px 0; }
  .row { display: flex; align-items: center; gap: 8px; }
  .row .chip { flex: 0 0 auto; }
  button.link {
    border: none;
    background: none;
    padding: 2px 4px;
    font-size: 12px;
    color: var(--accent);
  }
  button.link.danger { color: var(--danger); }
  .editor {
    margin: 6px 0 4px;
    padding: 8px 10px;
    background: #faf7f2;
    border-radius: 8px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .check { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; font-size: 13px; }
  .rel { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
  .rel > span { color: var(--muted); }
  .unassigned {
    margin-top: 14px;
    padding: 10px;
    border: 1px dashed var(--line);
    border-radius: 8px;
  }
  .unassigned.drag-over { border-color: var(--accent); background: #fbf6ee; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
