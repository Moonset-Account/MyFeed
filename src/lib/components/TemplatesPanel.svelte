<script lang="ts">
  import { appState } from '../store';
  import { tripFromTemplate } from '../logic';

  let tripName = $state('');
  let tripDate = $state('');
  let fromTemplateId = $state('');

  function gearName(id: string): string {
    return $appState.gear.find((g) => g.id === id)?.name ?? '（已删除的装备）';
  }

  function removeTemplate(id: string) {
    appState.update((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
  }

  function createTrip() {
    const tpl = $appState.templates.find((t) => t.id === fromTemplateId);
    const name = tripName.trim();
    if (!tpl || !name) return;
    const trip = tripFromTemplate(tpl, name, tripDate);
    appState.update((s) => ({ ...s, trips: [...s.trips, trip] }));
    tripName = '';
    tripDate = '';
    fromTemplateId = '';
  }
</script>

<div class="card">
  <h2>用模板创建行程</h2>
  {#if $appState.templates.length === 0}
    <p class="muted">还没有模板。在“行程”页筹备好一次行程后，可以把它存为模板复用。</p>
  {:else}
    <div class="row">
      <select bind:value={fromTemplateId}>
        <option value="">选择模板…</option>
        {#each $appState.templates as tpl (tpl.id)}
          <option value={tpl.id}>{tpl.name}</option>
        {/each}
      </select>
      <input placeholder="新行程名称" bind:value={tripName} />
      <input type="date" bind:value={tripDate} />
      <button class="primary" onclick={createTrip} disabled={!fromTemplateId || !tripName.trim()}>
        创建行程
      </button>
    </div>
  {/if}
</div>

{#each $appState.templates as tpl (tpl.id)}
  <div class="card">
    <div class="row" style="justify-content: space-between;">
      <h3>{tpl.name}</h3>
      <button class="small danger" onclick={() => removeTemplate(tpl.id)}>删除模板</button>
    </div>
    <table>
      <thead>
        <tr><th>装备</th><th>数量</th></tr>
      </thead>
      <tbody>
        {#each tpl.requirements as req (req.gearId)}
          <tr>
            <td>{gearName(req.gearId)}</td>
            <td>{req.quantity}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/each}
