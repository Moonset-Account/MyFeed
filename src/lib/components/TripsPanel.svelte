<script lang="ts">
  import { appState } from '../store';
  import {
    assessRequirement,
    canDepart,
    completeReturn,
    depart,
    saveAsTemplate,
    tripFromTemplate,
    tripWarnings,
    uid,
  } from '../logic';
  import type { Trip } from '../types';

  let newName = $state('');
  let newDate = $state('');
  let templateId = $state('');
  let selectedId = $state<string | null>(null);
  let reqGearId = $state('');
  let reqQty = $state(1);
  let templateName = $state('');

  const selected = $derived($appState.trips.find((t) => t.id === selectedId) ?? null);
  const warnings = $derived(selected ? tripWarnings(selected, $appState.gear) : []);
  const allChecked = $derived(
    selected !== null && selected.checklist.length > 0 && selected.checklist.every((c) => c.checked),
  );

  function gearName(id: string): string {
    return $appState.gear.find((g) => g.id === id)?.name ?? '（已删除的装备）';
  }

  function createTrip() {
    const name = newName.trim();
    if (!name) return;
    let trip: Trip;
    const tpl = $appState.templates.find((t) => t.id === templateId);
    if (tpl) {
      trip = tripFromTemplate(tpl, name, newDate);
    } else {
      trip = { id: uid(), name, date: newDate, requirements: [], status: 'planning', checklist: [] };
    }
    appState.update((s) => ({ ...s, trips: [...s.trips, trip] }));
    newName = '';
    newDate = '';
    templateId = '';
    selectedId = trip.id;
  }

  function patchTrip(id: string, fn: (t: Trip) => Trip) {
    appState.update((s) => ({ ...s, trips: s.trips.map((t) => (t.id === id ? fn(t) : t)) }));
  }

  function removeTrip(id: string) {
    appState.update((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== id) }));
    if (selectedId === id) selectedId = null;
  }

  function addRequirement(trip: Trip) {
    if (!reqGearId || reqQty < 1) return;
    if (trip.requirements.some((r) => r.gearId === reqGearId)) return;
    patchTrip(trip.id, (t) => ({
      ...t,
      requirements: [...t.requirements, { gearId: reqGearId, quantity: reqQty }],
    }));
    reqGearId = '';
    reqQty = 1;
  }

  function setReqQty(trip: Trip, gearId: string, qty: number) {
    patchTrip(trip.id, (t) => ({
      ...t,
      requirements: t.requirements.map((r) =>
        r.gearId === gearId ? { ...r, quantity: Math.max(1, qty) } : r,
      ),
    }));
  }

  function removeRequirement(trip: Trip, gearId: string) {
    patchTrip(trip.id, (t) => ({
      ...t,
      requirements: t.requirements.filter((r) => r.gearId !== gearId),
    }));
  }

  function doDepart(trip: Trip) {
    appState.update((s) => ({
      ...s,
      trips: s.trips.map((t) => (t.id === trip.id ? depart(t, s.gear) : t)),
    }));
  }

  function patchChecklist(trip: Trip, gearId: string, changes: Partial<Trip['checklist'][number]>) {
    patchTrip(trip.id, (t) => ({
      ...t,
      checklist: t.checklist.map((c) => (c.gearId === gearId ? { ...c, ...changes } : c)),
    }));
  }

  function doCompleteReturn(trip: Trip) {
    appState.update((s) => {
      const result = completeReturn(trip, s.gear, s.repairs);
      return {
        ...s,
        gear: result.gear,
        repairs: result.repairs,
        trips: s.trips.map((t) => (t.id === trip.id ? result.trip : t)),
      };
    });
  }

  function doSaveTemplate(trip: Trip) {
    const name = templateName.trim() || trip.name;
    const tpl = saveAsTemplate(trip, name);
    appState.update((s) => ({ ...s, templates: [...s.templates, tpl] }));
    templateName = '';
  }

  const statusLabel: Record<Trip['status'], string> = {
    planning: '筹备中',
    departed: '已出发',
    returned: '已归来',
  };
</script>

<div class="card">
  <h2>新建行程</h2>
  <div class="row">
    <input placeholder="行程名称，如：五一武功山" bind:value={newName} />
    <input type="date" bind:value={newDate} />
    <select bind:value={templateId}>
      <option value="">空白行程</option>
      {#each $appState.templates as tpl (tpl.id)}
        <option value={tpl.id}>从模板：{tpl.name}</option>
      {/each}
    </select>
    <button class="primary" onclick={createTrip} disabled={!newName.trim()}>创建</button>
  </div>
</div>

{#if $appState.trips.length === 0}
  <p class="muted">还没有行程。可以从模板快速创建，也可以建空白行程后逐项添加装备。</p>
{/if}

<div class="layout">
  <div>
    {#each $appState.trips as trip (trip.id)}
      <div class="card trip-item" class:selected={selectedId === trip.id}>
        <button class="link" onclick={() => (selectedId = trip.id)}>
          <strong>{trip.name}</strong>
        </button>
        <span class="muted">{trip.date || '未定日期'}</span>
        <span class="badge" class:warn={trip.status === 'departed'}>{statusLabel[trip.status]}</span>
      </div>
    {/each}
  </div>

  {#if selected}
    <div class="card detail">
      <div class="row" style="justify-content: space-between;">
        <h2>{selected.name} <span class="badge">{statusLabel[selected.status]}</span></h2>
        <button class="small danger" onclick={() => removeTrip(selected.id)}>删除行程</button>
      </div>
      <p class="muted">出发日期：{selected.date || '未定'}</p>

      {#if selected.status === 'planning'}
        <h3>装备分配</h3>
        <div class="row">
          <select bind:value={reqGearId}>
            <option value="">选择装备…</option>
            {#each $appState.gear as g (g.id)}
              <option value={g.id}>{g.name}（可用 {Math.max(0, g.owned - g.damaged)}）</option>
            {/each}
          </select>
          <input type="number" min="1" bind:value={reqQty} />
          <button onclick={() => addRequirement(selected)} disabled={!reqGearId}>加入清单</button>
        </div>

        {#if selected.requirements.length > 0}
          <table>
            <thead>
              <tr><th>装备</th><th>需要</th><th>可用</th><th>状态</th><th></th></tr>
            </thead>
            <tbody>
              {#each selected.requirements as req (req.gearId)}
                {@const item = $appState.gear.find((g) => g.id === req.gearId)}
                <tr>
                  <td>{item ? item.name : '（已删除的装备）'}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={req.quantity}
                      onchange={(e) => setReqQty(selected, req.gearId, Number(e.currentTarget.value) || 1)}
                    />
                  </td>
                  <td>{item ? Math.max(0, item.owned - item.damaged) : 0}</td>
                  <td>
                    {#if item}
                      {@const a = assessRequirement(item, req.quantity)}
                      {#if a.shortage > 0}<span class="badge danger">缺 {a.shortage}</span>{/if}
                      {#if a.hasDamaged}<span class="badge warn">{a.damaged} 件损坏</span>{/if}
                      {#if a.batteryLow}<span class="badge warn">电池未充电</span>{/if}
                      {#if a.shortage === 0 && !a.hasDamaged && !a.batteryLow}
                        <span class="badge">就绪</span>
                      {/if}
                    {:else}
                      <span class="badge danger">装备已删除</span>
                    {/if}
                  </td>
                  <td><button class="small danger" onclick={() => removeRequirement(selected, req.gearId)}>移除</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        {#if warnings.length > 0}
          <h3>出发前提醒</h3>
          <ul class="warn-list">
            {#each warnings as w (w.kind + w.gearId)}
              <li class:danger={w.kind === 'shortage'}>
                {#if w.kind === 'shortage'}⛔{:else if w.kind === 'damaged'}🛠️{:else}🔋{/if}
                <strong>{w.gearName}</strong>：{w.message}
              </li>
            {/each}
          </ul>
        {/if}

        <div class="row" style="margin-top: 12px;">
          <button
            class="primary"
            onclick={() => doDepart(selected)}
            disabled={selected.requirements.length === 0 || !canDepart(selected, $appState.gear)}
          >
            确认出发（生成清单）
          </button>
          {#if !canDepart(selected, $appState.gear)}
            <span class="muted">存在缺件，无法出发</span>
          {/if}
        </div>

        <h3 style="margin-top: 18px;">存为模板</h3>
        <div class="row">
          <input placeholder="模板名称（默认用行程名）" bind:value={templateName} />
          <button onclick={() => doSaveTemplate(selected)} disabled={selected.requirements.length === 0}>
            保存模板
          </button>
        </div>
      {:else if selected.status === 'departed'}
        <h3>归来检查</h3>
        <p class="muted">对照出发清单逐项核对：填写收回数量与新增损坏，勾选确认。</p>
        <table>
          <thead>
            <tr><th>装备</th><th>带走</th><th>收回</th><th>新增损坏</th><th>已核对</th></tr>
          </thead>
          <tbody>
            {#each selected.checklist as entry (entry.gearId)}
              <tr>
                <td>{entry.name}</td>
                <td>{entry.quantity}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max={entry.quantity}
                    value={entry.returnedQty}
                    onchange={(e) =>
                      patchChecklist(selected, entry.gearId, {
                        returnedQty: Math.min(entry.quantity, Math.max(0, Number(e.currentTarget.value) || 0)),
                      })}
                  />
                  {#if entry.returnedQty < entry.quantity}
                    <span class="badge danger">少 {entry.quantity - entry.returnedQty}</span>
                  {/if}
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max={entry.returnedQty}
                    value={entry.newlyDamaged}
                    onchange={(e) =>
                      patchChecklist(selected, entry.gearId, {
                        newlyDamaged: Math.min(entry.returnedQty, Math.max(0, Number(e.currentTarget.value) || 0)),
                      })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={entry.checked}
                    onchange={(e) => patchChecklist(selected, entry.gearId, { checked: e.currentTarget.checked })}
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="row" style="margin-top: 12px;">
          <button class="primary" onclick={() => doCompleteReturn(selected)} disabled={!allChecked}>
            完成归来检查
          </button>
          {#if !allChecked}<span class="muted">逐项勾选“已核对”后才能完成</span>{/if}
        </div>
      {:else}
        <h3>归来清单（已归档）</h3>
        <table>
          <thead>
            <tr><th>装备</th><th>带走</th><th>收回</th><th>新增损坏</th></tr>
          </thead>
          <tbody>
            {#each selected.checklist as entry (entry.gearId)}
              <tr>
                <td>{entry.name}</td>
                <td>{entry.quantity}</td>
                <td>
                  {entry.returnedQty}
                  {#if entry.returnedQty < entry.quantity}
                    <span class="badge danger">遗失 {entry.quantity - entry.returnedQty}</span>
                  {/if}
                </td>
                <td>{entry.newlyDamaged > 0 ? entry.newlyDamaged : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(220px, 300px) 1fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 800px) {
    .layout { grid-template-columns: 1fr; }
  }
  .trip-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
  }
  .trip-item.selected {
    border-color: var(--accent);
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    font-size: 15px;
  }
  .detail h3 {
    margin-bottom: 8px;
  }
</style>
