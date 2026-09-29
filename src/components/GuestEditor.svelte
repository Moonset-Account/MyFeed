<script lang="ts">
  import {
    doAssign,
    doRemoveGuest,
    doSetRelation,
    doUpdateGuest,
    seating,
    selectedGuestId,
  } from '../lib/store';

  let assignTarget = '';

  $: guest = $seating.guests.find((g) => g.id === $selectedGuestId) ?? null;
  $: others = guest ? $seating.guests.filter((g) => g.id !== guest?.id) : [];
  $: freeSeats = $seating.tables.flatMap((t) =>
    ($seating.seats[t.id] ?? [])
      .map((gid, i) => ({ table: t, gid, i }))
      .filter((s) => !s.gid)
      .map((s) => ({
        value: `${s.table.id}:${s.i}`,
        label: `${s.table.name} ${s.i + 1} 号位${s.i < s.table.accessibleSeats ? '（无障碍）' : ''}`,
      })),
  );

  function assignFromSelect(): void {
    if (!guest || !assignTarget) return;
    const [tableId, idx] = assignTarget.split(':');
    doAssign(guest.id, tableId, Number(idx));
    assignTarget = '';
  }
</script>

<section class="panel editor">
  <h2>宾客详情</h2>
  {#if !guest}
    <p class="empty">在名单或座位图中点击一位宾客，即可编辑其同行 / 需避开关系与无障碍需求。</p>
  {:else}
    <div class="field">
      <label for="guest-name">姓名</label>
      <input
        id="guest-name"
        type="text"
        value={guest.name}
        on:change={(e) => guest && doUpdateGuest(guest.id, { name: e.currentTarget.value })}
      />
    </div>
    <label class="inline">
      <input
        type="checkbox"
        checked={guest.needsAccessible}
        on:change={(e) => guest && doUpdateGuest(guest.id, { needsAccessible: e.currentTarget.checked })}
      />
      需要无障碍座位
    </label>

    {#if freeSeats.length > 0}
      <div class="field">
        <label for="assign-seat">安排到空位</label>
        <select id="assign-seat" bind:value={assignTarget} on:change={assignFromSelect}>
          <option value="" disabled>选择座位…</option>
          {#each freeSeats as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if others.length > 0}
      <table class="relations">
        <thead>
          <tr><th>宾客</th><th>同行</th><th>需避开</th></tr>
        </thead>
        <tbody>
          {#each others as o (o.id)}
            <tr>
              <td>{o.name}</td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`与${o.name}同行`}
                  checked={guest.together.includes(o.id)}
                  on:change={(e) => guest && doSetRelation(guest.id, o.id, 'together', e.currentTarget.checked)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`避开${o.name}`}
                  checked={guest.avoid.includes(o.id)}
                  on:change={(e) => guest && doSetRelation(guest.id, o.id, 'avoid', e.currentTarget.checked)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="hint">“同行”与“需避开”互斥：勾选一项会自动取消两人之间的另一项。</p>
    {/if}

    <button type="button" class="danger" on:click={() => guest && doRemoveGuest(guest.id)}>
      删除宾客
    </button>
  {/if}
</section>
