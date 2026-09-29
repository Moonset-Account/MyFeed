<script lang="ts">
  import { actions } from '../lib/store';
  import { categories, readyCount, chargedCount } from '../lib/inventory';
  import type { Gear, GearCategory } from '../lib/types';

  let { gears }: { gears: Gear[] } = $props();

  let name = $state('');
  let category = $state<GearCategory>('帐篷');
  let total = $state(1);
  let damaged = $state(0);
  let uncharged = $state(0);
  let usesBatteries = $state(false);
  let notes = $state('');

  function numberFrom(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function addGear() {
    actions.addGear({
      name,
      category,
      total,
      damaged: usesBatteries ? damaged : damaged,
      uncharged: usesBatteries ? uncharged : 0,
      usesBatteries,
      notes
    });
    name = '';
    total = 1;
    damaged = 0;
    uncharged = 0;
    usesBatteries = false;
    notes = '';
  }
</script>

<section class="panel">
  <div class="panel-heading">
    <div>
      <p class="eyebrow">Inventory</p>
      <h2>装备库存</h2>
    </div>
    <p class="muted">维护拥有数量、完好/损坏状态，以及电池设备的未充电数量。</p>
  </div>

  <form class="editor" onsubmit={(event) => { event.preventDefault(); addGear(); }}>
    <label>
      装备名称
      <input bind:value={name} required maxlength="40" placeholder="例如：双人帐篷" />
    </label>
    <label>
      类别
      <select bind:value={category}>
        {#each categories as item (item)}
          <option value={item}>{item}</option>
        {/each}
      </select>
    </label>
    <label>
      总数
      <input type="number" min="0" max="999" bind:value={total} />
    </label>
    <label>
      损坏数
      <input type="number" min="0" max={total} bind:value={damaged} />
    </label>
    <label class="checkline">
      <input type="checkbox" bind:checked={usesBatteries} />
      使用电池
    </label>
    {#if usesBatteries}
      <label>
        未充电数
        <input type="number" min="0" max={Math.max(0, total - damaged)} bind:value={uncharged} />
      </label>
    {/if}
    <label class="wide">
      备注
      <input bind:value={notes} maxlength="120" placeholder="型号、配件、注意事项" />
    </label>
    <button class="primary" type="submit" disabled={!name.trim()}>加入库存</button>
  </form>

  <div class="gear-grid">
    {#each gears as gear (gear.id)}
      <article class="gear-card" class:warning={gear.damaged > 0 || gear.uncharged > 0}>
        <header>
          <div>
            <span class="tag">{gear.category}</span>
            <h3>{gear.name}</h3>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="删除 {gear.name}"
            onclick={() => {
              if (confirm(`删除「${gear.name}」？相关行程和模板中的该项也会移除。`)) actions.deleteGear(gear.id);
            }}
          >×</button>
        </header>

        <div class="counts">
          <label>
            总数
            <input
              type="number"
              min="0"
              max="999"
              value={gear.total}
              oninput={(event) => actions.updateGear(gear.id, { total: numberFrom(event) })}
            />
          </label>
          <label>
            损坏
            <input
              type="number"
              min="0"
              max={gear.total}
              value={gear.damaged}
              oninput={(event) => actions.updateGear(gear.id, { damaged: numberFrom(event) })}
            />
          </label>
          {#if gear.usesBatteries}
            <label>
              未充电
              <input
                type="number"
                min="0"
                max={Math.max(0, gear.total - gear.damaged)}
                value={gear.uncharged}
                oninput={(event) => actions.updateGear(gear.id, { uncharged: numberFrom(event) })}
              />
            </label>
          {/if}
        </div>

        <p class="status-line">
          <span>{readyCount(gear)} 件可用</span>
          {#if gear.usesBatteries}<span>{chargedCount(gear)} 件已充电</span>{/if}
          {#if gear.damaged > 0}<strong class="danger">{gear.damaged} 件损坏</strong>{/if}
          {#if gear.uncharged > 0}<strong class="alert">{gear.uncharged} 件未充电</strong>{/if}
        </p>

        <label class="notes-edit">
          备注
          <input
            value={gear.notes}
            maxlength="120"
            onchange={(event) => actions.updateGear(gear.id, { notes: (event.currentTarget as HTMLInputElement).value })}
          />
        </label>

        <div class="card-actions">
          {#if gear.usesBatteries}
            <button type="button" disabled={gear.uncharged === 0} onclick={() => actions.chargeGear(gear.id)}>
              全部标记已充电
            </button>
          {/if}
          {#if gear.damaged > 0}
            <button type="button" onclick={() => actions.addRepairTodo({ gearId: gear.id, quantity: 1, note: '库存中发现损坏' })}>
              加入维修待办
            </button>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</section>
