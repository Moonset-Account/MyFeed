<script lang="ts">
  import { actions } from '../lib/store';
  import { chargedCount, readyCount } from '../lib/inventory';
  import type { AllocationIssue, Gear, Template, Trip } from '../lib/types';

  let { gears, trips, templates }: { gears: Gear[]; trips: Trip[]; templates: Template[] } = $props();

  let tripName = $state('周末露营');
  let destination = $state('');
  let date = $state(new Date().toISOString().slice(0, 10));
  let templateId = $state('');
  let selectedTripId = $state('');
  let templateName = $state('');

  const selectedTrip = $derived(trips.find((trip) => trip.id === selectedTripId) ?? trips[0]);
  const issueMap = $derived(
    new Map<string, AllocationIssue>(
      selectedTrip
        ? selectedTrip.allocations
            .map((allocation) => {
              const gear = gears.find((item) => item.id === allocation.gearId);
              if (!gear) return undefined;
              const ready = readyCount(gear);
              const healthy = Math.min(allocation.quantity, ready);
              const charged = gear.usesBatteries
                ? Math.min(allocation.charged, chargedCount(gear), healthy)
                : healthy;
              return [
                allocation.gearId,
                {
                  gearId: gear.id,
                  name: gear.name,
                  shortage: Math.max(0, allocation.quantity - gear.total),
                  damaged: Math.min(Math.max(0, allocation.quantity - ready), gear.damaged),
                  uncharged: Math.max(0, healthy - charged)
                }
              ] satisfies [string, AllocationIssue];
            })
            .filter((entry): entry is [string, AllocationIssue] => Boolean(entry))
        : []
    )
  );
  const blockingShortage = $derived(
    selectedTrip ? [...issueMap.values()].some((issue) => issue.shortage > 0) : false
  );

  function numberFrom(event: Event): number {
    return Number((event.currentTarget as HTMLInputElement).value);
  }

  function createTrip() {
    const id = actions.addTrip({
      name: tripName,
      destination,
      date,
      templateId: templateId || undefined
    });
    if (id) selectedTripId = id;
  }

  function applyTemplate(template: Template) {
    if (!selectedTrip || selectedTrip.status !== '准备中') return;
    for (const allocation of template.allocations) {
      actions.setAllocation(selectedTrip.id, allocation.gearId, {
        quantity: allocation.quantity,
        charged: allocation.charged
      });
    }
  }

  function saveTemplate() {
    if (!selectedTrip) return;
    actions.saveTripAsTemplate(selectedTrip.id, templateName || `${selectedTrip.name}模板`);
    templateName = '';
  }

  function completeReturn(trip: Trip) {
    const unchecked = (trip.returnItems ?? []).filter((item) => !item.checked).length;
    const message = unchecked > 0
      ? `还有 ${unchecked} 件未勾选检查。仍要完成归来核对吗？未勾选项目也会按已归还处理。`
      : '确认完成这次归来核对？';
    if (confirm(message)) actions.completeReturn(trip.id);
  }
</script>

<section class="panel">
  <div class="panel-heading">
    <div>
      <p class="eyebrow">Trips</p>
      <h2>出行与归来检查</h2>
    </div>
    <p class="muted">出发前分配装备；系统会提示缺件、被迫带上的损坏件和未充电电池。</p>
  </div>

  <form class="trip-create" onsubmit={(event) => { event.preventDefault(); createTrip(); }}>
    <label>
      行程名称
      <input bind:value={tripName} required maxlength="40" />
    </label>
    <label>
      日期
      <input type="date" bind:value={date} required />
    </label>
    <label>
      目的地
      <input bind:value={destination} maxlength="60" placeholder="选填" />
    </label>
    <label>
      使用模板
      <select bind:value={templateId}>
        <option value="">空白行程</option>
        {#each templates as template (template.id)}
          <option value={template.id}>{template.name}</option>
        {/each}
      </select>
    </label>
    <button class="primary" type="submit">新建行程</button>
  </form>

  {#if trips.length === 0}
    <div class="empty-state">还没有行程。新建一次出行后即可分配装备。</div>
  {:else if selectedTrip}
    <div class="trip-layout">
      <aside class="trip-list">
        {#each trips as trip (trip.id)}
          <button
            type="button"
            class:active={selectedTrip?.id === trip.id}
            onclick={() => (selectedTripId = trip.id)}
          >
            <strong>{trip.name}</strong>
            <span>{trip.date || '未设日期'} · {trip.status}</span>
          </button>
        {/each}
      </aside>

      <article class="trip-detail">
        <header class="detail-header">
          <div>
            <span class="status-pill">{selectedTrip.status}</span>
            <h3>{selectedTrip.name}</h3>
            <p>{selectedTrip.destination || '未填写目的地'} · {selectedTrip.date}</p>
          </div>
          <button
            type="button"
            class="danger-button"
            onclick={() => {
              if (confirm('删除该行程不会自动把已出发装备退回库存。确定删除吗？')) {
                actions.deleteTrip(selectedTrip.id);
              }
            }}
          >删除行程</button>
        </header>

        {#if selectedTrip.status === '准备中'}
          <div class="allocation-meta">
            <label>
              名称
              <input
                value={selectedTrip.name}
                onchange={(event) => actions.updateTrip(selectedTrip.id, { name: (event.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label>
              日期
              <input
                type="date"
                value={selectedTrip.date}
                onchange={(event) => actions.updateTrip(selectedTrip.id, { date: (event.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label>
              目的地
              <input
                value={selectedTrip.destination}
                onchange={(event) => actions.updateTrip(selectedTrip.id, { destination: (event.currentTarget as HTMLInputElement).value })}
              />
            </label>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>装备</th><th>库存</th><th>分配数</th>{#if true}<th>充电数</th>{/if}<th>出发提示</th></tr>
              </thead>
              <tbody>
                {#each gears as gear (gear.id)}
                  {@const allocation = selectedTrip.allocations.find((item) => item.gearId === gear.id)}
                  {@const quantity = allocation?.quantity ?? 0}
                  {@const issue = issueMap.get(gear.id)}
                  <tr>
                    <td>
                      <strong>{gear.name}</strong>
                      <span class="cell-sub">{gear.category}</span>
                    </td>
                    <td>{gear.total} 总数 / {readyCount(gear)} 可用</td>
                    <td>
                      <input
                        class="small-input"
                        type="number"
                        min="0"
                        max="999"
                        value={quantity}
                        oninput={(event) => actions.setAllocation(selectedTrip.id, gear.id, { quantity: numberFrom(event) })}
                      />
                    </td>
                    <td>
                      {#if gear.usesBatteries}
                        <input
                          class="small-input"
                          type="number"
                          min="0"
                          max={Math.min(quantity, chargedCount(gear))}
                          value={allocation?.charged ?? 0}
                          oninput={(event) => actions.setAllocation(selectedTrip.id, gear.id, { charged: numberFrom(event) })}
                        />
                      {:else}
                        <span class="muted">—</span>
                      {/if}
                    </td>
                    <td>
                      {#if issue}
                        <div class="issue-stack">
                          {#if issue.shortage > 0}<span class="danger">缺 {issue.shortage} 件</span>{/if}
                          {#if issue.damaged > 0}<span class="warning-text">{issue.damaged} 件损坏</span>{/if}
                          {#if issue.uncharged > 0}<span class="alert">{issue.uncharged} 件未充电</span>{/if}
                        </div>
                      {:else if quantity > 0}
                        <span class="ok">可按完好已充电状态带出</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="detail-actions">
            <button class="primary" type="button" disabled={blockingShortage} onclick={() => actions.startTrip(selectedTrip.id)}>
              确认出发并扣除库存
            </button>
            {#if blockingShortage}
              <span class="danger">存在缺件，补齐或减少分配后才能出发。</span>
            {/if}
          </div>

          <div class="template-strip">
            <strong>复用模板</strong>
            {#each templates as template (template.id)}
              <button type="button" onclick={() => applyTemplate(template)}>载入「{template.name}」</button>
            {/each}
          </div>
          <form class="save-template" onsubmit={(event) => { event.preventDefault(); saveTemplate(); }}>
            <input bind:value={templateName} placeholder="将当前分配另存为模板，例如：冬季两日" maxlength="40" />
            <button type="submit">保存为模板</button>
          </form>
        {:else if selectedTrip.status === '出行中'}
          <p class="trip-note">逐项核对实物。少归还会保留为缺件，损坏和未充电会写入归来结果。</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>检查</th><th>装备</th><th>出发</th><th>归还</th><th>损坏</th><th>未充电</th></tr>
              </thead>
              <tbody>
                {#each selectedTrip.returnItems ?? [] as item (`${selectedTrip.id}-${item.gearId}`)}
                  {@const gear = gears.find((candidate) => candidate.id === item.gearId)}
                  <tr>
                    <td>
                      <input type="checkbox" bind:checked={item.checked} onchange={() => actions.setReturnItem(selectedTrip.id, item.gearId, { checked: item.checked })} />
                    </td>
                    <td><strong>{gear?.name ?? '已删除装备'}</strong></td>
                    <td>{item.expected}</td>
                    <td>
                      <input class="small-input" type="number" min="0" max={item.expected} value={item.returned}
                        oninput={(event) => actions.setReturnItem(selectedTrip.id, item.gearId, { returned: numberFrom(event) })} />
                    </td>
                    <td>
                      <input class="small-input" type="number" min="0" max={item.returned} value={item.damaged}
                        oninput={(event) => actions.setReturnItem(selectedTrip.id, item.gearId, { damaged: numberFrom(event) })} />
                    </td>
                    <td>
                      {#if gear?.usesBatteries}
                        <input class="small-input" type="number" min="0" max={item.returned - item.damaged} value={item.uncharged}
                          oninput={(event) => actions.setReturnItem(selectedTrip.id, item.gearId, { uncharged: numberFrom(event) })} />
                      {:else}
                        <span class="muted">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="detail-actions">
            <button class="primary" type="button" onclick={() => completeReturn(selectedTrip)}>完成归来核对</button>
          </div>
        {:else}
          {@const returnItems = selectedTrip.returnItems ?? []}
          {@const returned = returnItems.reduce((sum, item) => sum + item.returned, 0)}
          {@const missing = returnItems.reduce((sum, item) => sum + Math.max(0, item.expected - item.returned), 0)}
          {@const damaged = returnItems.reduce((sum, item) => sum + item.damaged, 0)}
          {@const uncharged = returnItems.reduce((sum, item) => sum + item.uncharged, 0)}
          <div class="result-grid">
            <div><strong>{returned}</strong><span>已归还</span></div>
            <div><strong>{missing}</strong><span>缺件</span></div>
            <div><strong>{damaged}</strong><span>损坏</span></div>
            <div><strong>{uncharged}</strong><span>未充电</span></div>
          </div>
          <p class="muted">归还装备已回补库存；损坏件已创建维修待办。可在“维修待办”页处理。</p>
        {/if}
      </article>
    </div>
  {/if}
</section>
