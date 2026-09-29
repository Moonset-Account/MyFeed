<script lang="ts">
  import { conflicts, doAssign, doUnseat, seating, selectedGuestId } from '../lib/store';

  let dragKey: string | null = null;

  $: guestById = new Map($seating.guests.map((g) => [g.id, g]));
  $: conflictGuestIds = new Set($conflicts.flatMap((c) => c.guestIds));
  $: conflictTableIds = new Set(
    $conflicts.filter((c) => c.tableId).map((c) => c.tableId as string),
  );

  function key(tableId: string, index: number): string {
    return `${tableId}:${index}`;
  }

  function dragStart(event: DragEvent, guestId: string): void {
    event.dataTransfer?.setData('text/guest-id', guestId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function drop(event: DragEvent, tableId: string, seatIndex: number): void {
    event.preventDefault();
    dragKey = null;
    const gid = event.dataTransfer?.getData('text/guest-id');
    if (gid) doAssign(gid, tableId, seatIndex);
  }
</script>

<div class="tables-grid">
  {#each $seating.tables as table (table.id)}
    {@const seats = $seating.seats[table.id] ?? []}
    {@const occupied = seats.filter(Boolean).length}
    <section class="table-card" class:has-conflict={conflictTableIds.has(table.id)}>
      <header class="table-head">
        <h3>{table.name}</h3>
        <span class="cap">{occupied}/{table.capacity}</span>
      </header>
      <div class="seats" role="list">
        {#each seats as gid, i (i)}
          {@const guest = gid ? guestById.get(gid) : undefined}
          {@const accessible = i < table.accessibleSeats}
          <div
            class="seat"
            role="listitem"
            class:empty={!guest}
            class:accessible
            class:conflict={guest ? conflictGuestIds.has(guest.id) : false}
            class:drop-target={dragKey === key(table.id, i)}
            on:dragover|preventDefault
            on:dragenter={() => (dragKey = key(table.id, i))}
            on:dragleave={() => {
              if (dragKey === key(table.id, i)) dragKey = null;
            }}
            on:drop={(e) => drop(e, table.id, i)}
          >
            <span class="seat-no">
              {i + 1}{#if accessible}<span class="acc" title="无障碍座位">♿</span>{/if}
            </span>
            {#if guest}
              <div
                class="occupant"
                draggable="true"
                role="button"
                tabindex="0"
                on:dragstart={(e) => guest && dragStart(e, guest.id)}
                on:click={() => guest && selectedGuestId.set(guest.id)}
                on:keydown={(e) => {
                  if (e.key === 'Enter' && guest) selectedGuestId.set(guest.id);
                }}
                title="点击编辑详情，可拖动换座"
              >
                <span class="gname">
                  {guest.name}{#if guest.needsAccessible}<span class="badge" title="需要无障碍座位">♿</span>{/if}
                </span>
                <button
                  type="button"
                  class="remove"
                  title="移出座位"
                  on:click|stopPropagation={() => guest && doUnseat(guest.id)}
                >
                  ×
                </button>
              </div>
            {:else}
              <span class="placeholder">空位</span>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
