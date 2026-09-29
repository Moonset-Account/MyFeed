<script lang="ts">
  import { doAddGuest, doUnseat, seating, selectedGuestId, showToast } from '../lib/store';
  import { seatLocationOf } from '../lib/seating';

  let name = '';
  let needsAccessible = false;
  let dragOverPool = false;

  $: seatedIds = new Set(
    $seating.tables.flatMap((t) => ($seating.seats[t.id] ?? []).filter((x): x is string => Boolean(x))),
  );
  $: unassigned = $seating.guests.filter((g) => !seatedIds.has(g.id));
  $: seatedGuests = $seating.guests.filter((g) => seatedIds.has(g.id));

  function submit(): void {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('请输入宾客姓名');
      return;
    }
    doAddGuest(trimmed, needsAccessible);
    name = '';
    needsAccessible = false;
  }

  function dragStart(event: DragEvent, guestId: string): void {
    event.dataTransfer?.setData('text/guest-id', guestId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dropToPool(event: DragEvent): void {
    event.preventDefault();
    dragOverPool = false;
    const gid = event.dataTransfer?.getData('text/guest-id');
    if (gid && seatedIds.has(gid)) {
      doUnseat(gid);
      showToast('已移回未安排名单');
    }
  }

  function seatLabel(guestId: string): string {
    const loc = seatLocationOf($seating, guestId);
    if (!loc) return '';
    const table = $seating.tables.find((t) => t.id === loc.tableId);
    return `${table?.name ?? ''} ${loc.seatIndex + 1} 号位`;
  }
</script>

<section class="panel">
  <h2>宾客名单</h2>
  <form class="add-form" on:submit|preventDefault={submit}>
    <input type="text" placeholder="宾客姓名" bind:value={name} aria-label="宾客姓名" />
    <label class="inline">
      <input type="checkbox" bind:checked={needsAccessible} /> 需无障碍座位
    </label>
    <button type="submit" class="primary">添加</button>
  </form>

  <div
    class="pool"
    class:drop-target={dragOverPool}
    on:dragover|preventDefault
    on:dragenter={() => (dragOverPool = true)}
    on:dragleave={() => (dragOverPool = false)}
    on:drop={dropToPool}
    role="list"
    aria-label="未安排名单"
  >
    <h3>
      未安排（{unassigned.length}）
      <span class="hint-inline">把座位上的宾客拖到此处可取消入座</span>
    </h3>
    {#if unassigned.length === 0}
      <p class="empty">暂无未安排宾客</p>
    {/if}
    <div class="chips">
      {#each unassigned as g (g.id)}
        <button
          type="button"
          class="chip guest"
          class:selected={$selectedGuestId === g.id}
          draggable="true"
          on:dragstart={(e) => dragStart(e, g.id)}
          on:click={() => selectedGuestId.set(g.id)}
          title="点击编辑详情，拖动到座位入座"
        >
          {g.name}{#if g.needsAccessible}<span class="badge" title="需要无障碍座位">♿</span>{/if}
        </button>
      {/each}
    </div>
  </div>

  {#if seatedGuests.length > 0}
    <h3>已入座（{seatedGuests.length}）</h3>
    <ul class="seated-list">
      {#each seatedGuests as g (g.id)}
        <li>
          <button
            type="button"
            class="link"
            class:selected={$selectedGuestId === g.id}
            on:click={() => selectedGuestId.set(g.id)}
          >
            {g.name}{#if g.needsAccessible}<span class="badge">♿</span>{/if}
          </button>
          <span class="seat-label">{seatLabel(g.id)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
