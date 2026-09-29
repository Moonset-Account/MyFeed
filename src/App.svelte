<script lang="ts">
  import InventoryPanel from './lib/components/InventoryPanel.svelte';
  import TripsPanel from './lib/components/TripsPanel.svelte';
  import TemplatesPanel from './lib/components/TemplatesPanel.svelte';
  import RepairsPanel from './lib/components/RepairsPanel.svelte';
  import { appState } from './lib/store';

  type Tab = 'gear' | 'trips' | 'templates' | 'repairs';
  let tab = $state<Tab>('gear');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'gear', label: '装备库' },
    { key: 'trips', label: '行程' },
    { key: 'templates', label: '行程模板' },
    { key: 'repairs', label: '维修待办' },
  ];

  const openRepairs = $derived($appState.repairs.filter((r) => !r.done).length);
  const activeTrips = $derived($appState.trips.filter((t) => t.status !== 'returned').length);
</script>

<header>
  <h1>🏕️ 露营装备检查册</h1>
  <nav>
    {#each tabs as t (t.key)}
      <button class:active={tab === t.key} onclick={() => (tab = t.key)}>
        {t.label}
        {#if t.key === 'repairs' && openRepairs > 0}
          <span class="badge warn">{openRepairs}</span>
        {/if}
        {#if t.key === 'trips' && activeTrips > 0}
          <span class="badge">{activeTrips}</span>
        {/if}
      </button>
    {/each}
  </nav>
</header>

<main>
  {#if tab === 'gear'}
    <InventoryPanel />
  {:else if tab === 'trips'}
    <TripsPanel />
  {:else if tab === 'templates'}
    <TemplatesPanel />
  {:else}
    <RepairsPanel />
  {/if}
</main>

<style>
  header {
    padding: 18px 24px 0;
  }
  h1 {
    margin: 0 0 12px;
    font-size: 22px;
  }
  nav {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
    flex-wrap: wrap;
  }
  nav button {
    border: none;
    background: transparent;
    padding: 8px 14px;
    border-radius: 8px;
    color: var(--muted);
  }
  nav button.active {
    background: var(--accent);
    color: #fff;
  }
  nav button.active .badge {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }
  main {
    padding: 20px 24px 48px;
    max-width: 1080px;
  }
</style>
