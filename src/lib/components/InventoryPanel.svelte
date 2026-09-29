<script lang="ts">
  import { appState } from '../store';
  import { CATEGORIES, type Category, type GearItem } from '../types';
  import { availableOf, uid } from '../logic';

  let name = $state('');
  let category = $state<Category>('帐篷');
  let owned = $state(1);
  let batteryPowered = $state(false);

  function addGear() {
    const trimmed = name.trim();
    if (!trimmed || owned < 1) return;
    const item: GearItem = {
      id: uid(),
      name: trimmed,
      category,
      owned,
      damaged: 0,
      batteryPowered,
      batteryCharged: false,
      notes: '',
    };
    appState.update((s) => ({ ...s, gear: [...s.gear, item] }));
    name = '';
    owned = 1;
    batteryPowered = false;
  }

  function patch(id: string, changes: Partial<GearItem>) {
    appState.update((s) => ({
      ...s,
      gear: s.gear.map((g) => (g.id === id ? { ...g, ...changes } : g)),
    }));
  }

  function remove(id: string) {
    appState.update((s) => ({
      ...s,
      gear: s.gear.filter((g) => g.id !== id),
      trips: s.trips.map((t) => ({
        ...t,
        requirements: t.requirements.filter((r) => r.gearId !== id),
      })),
      templates: s.templates.map((t) => ({
        ...t,
        requirements: t.requirements.filter((r) => r.gearId !== id),
      })),
    }));
  }

  const grouped = $derived(
    CATEGORIES.map((c) => ({
      category: c,
      items: $appState.gear.filter((g) => g.category === c),
    })).filter((g) => g.items.length > 0),
  );
</script>

<div class="card">
  <h2>添加装备</h2>
  <div class="row">
    <input placeholder="装备名称，如：双人帐篷" bind:value={name} />
    <select bind:value={category}>
      {#each CATEGORIES as c (c)}
        <option value={c}>{c}</option>
      {/each}
    </select>
    <label>数量 <input type="number" min="1" bind:value={owned} /></label>
    <label><input type="checkbox" bind:checked={batteryPowered} /> 使用电池</label>
    <button class="primary" onclick={addGear} disabled={!name.trim()}>添加</button>
  </div>
</div>

{#if grouped.length === 0}
  <p class="muted">装备库为空，先添加几件装备吧。</p>
{/if}

{#each grouped as group (group.category)}
  <div class="card">
    <h3>{group.category}</h3>
    <table>
      <thead>
        <tr>
          <th>名称</th><th>拥有</th><th>损坏</th><th>可用</th><th>电池</th><th>备注</th><th></th>
        </tr>
      </thead>
      <tbody>
        {#each group.items as item (item.id)}
          <tr>
            <td>{item.name}</td>
            <td>
              <input
                type="number"
                min="0"
                value={item.owned}
                onchange={(e) => patch(item.id, { owned: Math.max(0, Number(e.currentTarget.value) || 0) })}
              />
            </td>
            <td>
              <input
                type="number"
                min="0"
                max={item.owned}
                value={item.damaged}
                onchange={(e) =>
                  patch(item.id, {
                    damaged: Math.min(item.owned, Math.max(0, Number(e.currentTarget.value) || 0)),
                  })}
              />
              {#if item.damaged > 0}<span class="badge danger">待修</span>{/if}
            </td>
            <td>{availableOf(item)}</td>
            <td>
              {#if item.batteryPowered}
                <label class="muted">
                  <input
                    type="checkbox"
                    checked={item.batteryCharged}
                    onchange={(e) => patch(item.id, { batteryCharged: e.currentTarget.checked })}
                  />
                  {item.batteryCharged ? '已充电' : '未充电'}
                </label>
                {#if !item.batteryCharged}<span class="badge warn">需充电</span>{/if}
              {:else}
                <span class="muted">—</span>
              {/if}
            </td>
            <td>
              <input
                value={item.notes}
                placeholder="备注"
                onchange={(e) => patch(item.id, { notes: e.currentTarget.value })}
              />
            </td>
            <td><button class="small danger" onclick={() => remove(item.id)}>删除</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/each}
