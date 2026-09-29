<script lang="ts">
  import { store, actions } from './lib/store';
  import { readyCount } from './lib/inventory';
  import GearPanel from './components/GearPanel.svelte';
  import TripPanel from './components/TripPanel.svelte';
  import TemplatePanel from './components/TemplatePanel.svelte';
  import RepairPanel from './components/RepairPanel.svelte';

  type Tab = 'gear' | 'trips' | 'templates' | 'repairs';
  let activeTab = $state<Tab>('gear');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'gear', label: '装备库存' },
    { id: 'trips', label: '行程检查' },
    { id: 'templates', label: '行程模板' },
    { id: 'repairs', label: '维修待办' }
  ];

</script>

<main>
  {#if $store}
    {@const gears = $store.gears}
    {@const activeTrips = $store.trips.filter((trip) => trip.status === '出行中').length}
    {@const repairCount = $store.repairTodos.filter((todo) => !todo.resolved).length}
    {@const totalGear = gears.reduce((sum, gear) => sum + gear.total, 0)}
    {@const readyGear = gears.reduce((sum, gear) => sum + readyCount(gear), 0)}
    {@const damagedGear = gears.reduce((sum, gear) => sum + gear.damaged, 0)}
    {@const unchargedGear = gears.reduce((sum, gear) => sum + gear.uncharged, 0)}

    <section class="hero">
      <div>
        <p class="eyebrow">Offline camping kit</p>
        <h1>露营装备检查册</h1>
        <p>维护装备数量与状态，规划一次出行，并在归来时逐项核销。所有数据只保存在当前浏览器。</p>
      </div>
      <div class="hero-actions">
        <span class="offline-badge">离线可用</span>
        <button
          type="button"
          onclick={() => {
            if (confirm('恢复演示数据会清除当前所有本地记录。确定继续吗？')) actions.resetDemo();
          }}
        >恢复演示数据</button>
      </div>
    </section>

    <section class="stats" aria-label="装备概览">
      <article>
        <strong>{totalGear}</strong>
        <span>装备总数</span>
      </article>
      <article>
        <strong>{readyGear}</strong>
        <span>当前可用</span>
      </article>
      <article class:attention={damagedGear > 0}>
        <strong>{damagedGear}</strong>
        <span>库存损坏</span>
      </article>
      <article class:attention={unchargedGear > 0}>
        <strong>{unchargedGear}</strong>
        <span>未充电</span>
      </article>
      <article class:attention={activeTrips > 0}>
        <strong>{activeTrips}</strong>
        <span>出行中</span>
      </article>
      <article class:attention={repairCount > 0}>
        <strong>{repairCount}</strong>
        <span>维修待办</span>
      </article>
    </section>

    <nav class="tabs" aria-label="主要功能">
      {#each tabs as tab (tab.id)}
        <button type="button" class:active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
          {tab.label}
          {#if tab.id === 'repairs' && repairCount > 0}<span class="badge">{repairCount}</span>{/if}
        </button>
      {/each}
    </nav>

    {#if activeTab === 'gear'}
      <GearPanel {gears} />
    {:else if activeTab === 'trips'}
      <TripPanel gears={gears} trips={$store.trips} templates={$store.templates} />
    {:else if activeTab === 'templates'}
      <TemplatePanel {gears} templates={$store.templates} />
    {:else}
      <RepairPanel {gears} repairTodos={$store.repairTodos} />
    {/if}
  {/if}
</main>
