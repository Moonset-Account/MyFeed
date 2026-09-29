<script lang="ts">
  import { store } from './lib/store.svelte';
  import ReminderPanel from './components/ReminderPanel.svelte';
  import PlantCard from './components/PlantCard.svelte';
  import PlantForm from './components/PlantForm.svelte';
  import PlantDetail from './components/PlantDetail.svelte';
  import BackupPanel from './components/BackupPanel.svelte';
  import type { Plant } from './lib/types';

  let showForm = $state(false);
  let editing = $state<Plant | null>(null);
  let detailId = $state<string | null>(null);

  const detailPlant = $derived(store.plants.find((p) => p.id === detailId) ?? null);

  function openAdd() {
    editing = null;
    showForm = true;
  }
  function openEdit(plant: Plant) {
    editing = plant;
    showForm = true;
  }
</script>

<div class="page">
  <header>
    <div>
      <h1>🌿 阳台植物养护日历</h1>
      <p class="sub">按上次实际养护日期生成待办 · 数据保存在本机浏览器</p>
    </div>
    <BackupPanel />
  </header>

  <ReminderPanel
    onOpenPlant={(id) => (detailId = id)}
  />

  <section class="plants-head">
    <h2>我的植物（{store.plants.length}）</h2>
    <button class="primary" onclick={openAdd}>+ 添加植物</button>
  </section>

  {#if store.plants.length === 0}
    <p class="empty">还没有植物，点击「添加植物」开始记录吧。</p>
  {:else}
    <div class="grid">
      {#each store.plants as plant (plant.id)}
        <PlantCard
          {plant}
          onOpen={() => (detailId = plant.id)}
          onEdit={() => openEdit(plant)}
        />
      {/each}
    </div>
  {/if}
</div>

{#if showForm}
  <PlantForm
    plant={editing}
    onClose={() => (showForm = false)}
  />
{/if}

{#if detailPlant}
  <PlantDetail
    plant={detailPlant}
    onClose={() => (detailId = null)}
    onEdit={() => {
      openEdit(detailPlant!);
    }}
  />
{/if}

<style>
  .page {
    max-width: 980px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { margin: 0; color: var(--muted); font-size: 13px; }
  .plants-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 28px 0 12px;
  }
  .plants-head h2 { font-size: 18px; margin: 0; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }
  .empty { color: var(--muted); }
</style>
