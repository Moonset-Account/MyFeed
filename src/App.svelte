<script lang="ts">
  import { onMount } from 'svelte';
  import type { AppData, CareTodo, CareTaskType, Plant } from './lib/types';
  import {
    activePostponements,
    addCareEvent,
    buildTodos,
    cancelPostponement,
    createEmptyData,
    createId,
    deletePlant,
    postponeWatering,
    upsertPlant
  } from './lib/care';
  import { backupToJSON, createBackupFileName, parseBackup } from './lib/backup';
  import { downloadTextFile, readFileAsText } from './lib/files';
  import { loadData, saveData } from './lib/storage';
  import { isValidISODate, todayISODate } from './lib/dates';
  import TodoList from './lib/components/TodoList.svelte';
  import PlantCard from './lib/components/PlantCard.svelte';
  import PlantForm from './lib/components/PlantForm.svelte';
  import PlantDetail from './lib/components/PlantDetail.svelte';
  import Modal from './lib/components/Modal.svelte';
  import PostponeDialog from './lib/components/PostponeDialog.svelte';

  let data: AppData = createEmptyData();
  let ready = false;
  let actionDate = todayISODate();
  let selectedPlantId: string | null = null;
  let formPlant: Plant | undefined = undefined;
  let showForm = false;
  let postponeTodo: CareTodo | null = null;
  let notice = '';
  let error = '';
  let confirmDeletePlant: Plant | null = null;

  onMount(() => {
    data = loadData();
    ready = true;
  });

  $: todos = ready ? buildTodos(data) : [];
  $: plantCardTodos = todos;
  $: selectedPlant = data.plants.find((plant) => plant.id === selectedPlantId) ?? null;
  $: postponementsByPlant = Object.fromEntries(
    data.plants.map((plant) => [plant.id, activePostponements(data.records, plant.id)])
  );
  $: overdueCount = todos.filter((todo) => todo.status === 'overdue').length;
  $: todayCount = todos.filter((todo) => todo.status === 'today').length;

  $: if (ready) {
    try {
      saveData(data);
    } catch (caught) {
      error = caught instanceof Error ? `本地保存失败：${caught.message}` : '本地保存失败。';
    }
  }

  function clearMessages(): void {
    notice = '';
    error = '';
  }

  function openAddPlant(): void {
    clearMessages();
    formPlant = undefined;
    showForm = true;
  }

  function openEditPlant(plant: Plant): void {
    clearMessages();
    formPlant = plant;
    selectedPlantId = plant.id;
    showForm = true;
  }

  function savePlant(event: CustomEvent<{
    id?: string;
    name: string;
    species: string;
    lightLocation: Plant['lightLocation'];
    waterIntervalDays: number;
    fertilizeIntervalDays?: number;
    repotIntervalDays?: number;
    notes: string;
    photoDataUrl?: string;
    lastWateredDate?: string;
    lastFertilizedDate?: string;
    lastRepottedDate?: string;
  }>): void {
    const draft = event.detail;
    const plant: Plant = {
      id: draft.id ?? createId(),
      name: draft.name,
      species: draft.species,
      lightLocation: draft.lightLocation,
      waterIntervalDays: draft.waterIntervalDays,
      fertilizeIntervalDays: draft.fertilizeIntervalDays,
      repotIntervalDays: draft.repotIntervalDays,
      notes: draft.notes || undefined,
      photoDataUrl: draft.photoDataUrl,
      createdAt: draft.id ? (formPlant?.createdAt ?? todayISODate()) : todayISODate()
    };
    let nextData = upsertPlant(data, plant);
    if (!draft.id) {
      const initialCareDates: Array<{ taskType: CareTaskType; date?: string }> = [
        { taskType: 'water', date: draft.lastWateredDate },
        { taskType: 'fertilize', date: draft.lastFertilizedDate },
        { taskType: 'repot', date: draft.lastRepottedDate }
      ];
      for (const item of initialCareDates) {
        if (item.date) {
          nextData = addCareEvent(nextData, { plantId: plant.id, taskType: item.taskType, date: item.date });
        }
      }
    }
    data = nextData;
    selectedPlantId = plant.id;
    showForm = false;
    formPlant = undefined;
    const hasInitialCare = Boolean(draft.lastWateredDate || draft.lastFertilizedDate || draft.lastRepottedDate);
    notice = draft.id
      ? '植物资料已保存。'
      : hasInitialCare
        ? '植物和最近一次实际养护已记录，待办已按实际日期生成。'
        : '植物已添加，待办已按建档日期生成。';
  }

  function recordCare(plant: Plant, taskType: CareTaskType, date = actionDate): void {
    if (!isValidISODate(date)) {
      error = '请选择有效的养护日期。';
      return;
    }
    data = addCareEvent(data, { plantId: plant.id, taskType, date });
    notice = `已记录 ${plant.name} 的${taskType === 'water' ? '浇水' : taskType === 'fertilize' ? '施肥' : '换盆'}。`;
  }

  function handleTodoComplete(event: CustomEvent<{ todo: CareTodo }>): void {
    recordCare({ id: event.detail.todo.plantId } as Plant, event.detail.todo.taskType, actionDate);
  }

  function openPostpone(event: CustomEvent<{ todo: CareTodo }>): void {
    clearMessages();
    postponeTodo = event.detail.todo;
  }

  function submitPostpone(event: CustomEvent<{ todo: CareTodo; days: number; date: string; reason: string }>): void {
    const { todo, days, date, reason } = event.detail;
    try {
      data = postponeWatering(data, { plantId: todo.plantId, days, date, reason });
      postponeTodo = null;
      notice = `${todo.plantName} 的浇水已顺延 ${days} 天；实际浇水前仍会保留提醒。`;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '顺延失败。';
    }
  }

  function handleCancelPostponement(event: CustomEvent<{ recordId: string }>): void {
    data = cancelPostponement(data, event.detail.recordId);
    notice = '已撤销顺延。';
  }

  function requestDelete(plant: Plant): void {
    clearMessages();
    confirmDeletePlant = plant;
  }

  function confirmDelete(): void {
    if (!confirmDeletePlant) return;
    data = deletePlant(data, confirmDeletePlant.id);
    notice = `已删除 ${confirmDeletePlant.name} 及其全部养护记录。`;
    selectedPlantId = null;
    confirmDeletePlant = null;
  }

  function exportBackup(): void {
    downloadTextFile(createBackupFileName(), backupToJSON(data));
    notice = '备份 JSON 已导出。';
  }

  async function importBackup(event: Event): Promise<void> {
    clearMessages();
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await readFileAsText(file));
      data = parseBackup(parsed);
      selectedPlantId = null;
      notice = '备份已导入并替换当前本地记录。';
    } catch (caught) {
      error = caught instanceof Error ? `导入失败：${caught.message}` : '导入失败：文件不是有效备份。';
    } finally {
      input.value = '';
    }
  }
</script>

<div class="app-shell">
  <header class="hero">
    <div>
      <p class="eyebrow">Balcony Plant Calendar</p>
      <h1>阳台植物养护日历</h1>
      <p class="hero-copy">
        按上次实际养护日期计算浇水、施肥与换盆；阴雨顺延单独留痕，不会把跳过误记成完成。
      </p>
    </div>
    <div class="hero-actions">
      <button class="primary" type="button" on:click={openAddPlant}>添加植物</button>
      <button class="secondary" type="button" on:click={exportBackup}>导出备份</button>
      <label class="file-button secondary">
        导入备份
        <input type="file" accept="application/json,.json" on:change={importBackup} />
      </label>
    </div>
  </header>

  <section class="stats" aria-label="提醒统计">
    <article><strong>{overdueCount}</strong><span>逾期</span></article>
    <article><strong>{todayCount}</strong><span>今天</span></article>
    <article><strong>{data.plants.length}</strong><span>植物</span></article>
    <article>
      <label for="action-date">记录日期</label>
      <input id="action-date" bind:value={actionDate} type="date" max={todayISODate()} />
    </article>
  </section>

  {#if notice}<div class="notice" role="status">{notice}</div>{/if}
  {#if error}<div class="error-banner" role="alert">{error}</div>{/if}

  <TodoList
    todos={todos}
    {postponementsByPlant}
    on:complete={handleTodoComplete}
    on:postpone={openPostpone}
    on:cancelPostponement={handleCancelPostponement}
  />

  <section class="plants-section">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Plant Cards</p>
        <h2>我的植物</h2>
      </div>
    </div>

    {#if data.plants.length === 0}
      <div class="empty-state">
        <div class="empty-illustration">🌿</div>
        <h3>从第一盆阳台植物开始</h3>
        <p>记录浇水间隔、摆放位置、换盆和施肥周期。所有数据只保存在当前浏览器中。</p>
        <button type="button" on:click={openAddPlant}>添加植物</button>
      </div>
    {:else}
      <div class="plant-grid">
        {#each data.plants as plant (plant.id)}
          <PlantCard
            {plant}
            todos={plantCardTodos}
            on:open={(event) => (selectedPlantId = event.detail)}
            on:edit={(event) => openEditPlant(event.detail)}
            on:quickWater={(event) => recordCare(event.detail, 'water')}
          />
        {/each}
      </div>
    {/if}
  </section>
</div>

{#if showForm}
  <Modal title={formPlant ? '编辑植物' : '添加植物'} on:close={() => (showForm = false)}>
    <PlantForm plant={formPlant} on:save={savePlant} on:cancel={() => (showForm = false)} />
  </Modal>
{/if}

{#if selectedPlant}
  <Modal title={selectedPlant.name} on:close={() => (selectedPlantId = null)}>
    <PlantDetail
      plant={selectedPlant}
      records={data.records}
      {actionDate}
      on:edit={(event) => openEditPlant(event.detail)}
      on:delete={(event) => requestDelete(event.detail)}
      on:close={() => (selectedPlantId = null)}
      on:recordCare={(event) => recordCare(event.detail.plant, event.detail.taskType, event.detail.date)}
    />
  </Modal>
{/if}

{#if postponeTodo}
  <Modal title="阴雨顺延浇水" on:close={() => (postponeTodo = null)}>
    <PostponeDialog todo={postponeTodo} on:cancel={() => (postponeTodo = null)} on:submit={submitPostpone} />
  </Modal>
{/if}

{#if confirmDeletePlant}
  <Modal title="确认删除" on:close={() => (confirmDeletePlant = null)}>
    <div class="confirm-box">
      <p>将删除 <strong>{confirmDeletePlant.name}</strong> 及其全部浇水、施肥、换盆和顺延记录。</p>
      <p class="muted">建议先导出备份。此操作只影响本机浏览器记录。</p>
      <div class="modal-actions">
        <button type="button" class="ghost" on:click={() => (confirmDeletePlant = null)}>取消</button>
        <button type="button" class="danger" on:click={confirmDelete}>确认删除</button>
      </div>
    </div>
  </Modal>
{/if}
