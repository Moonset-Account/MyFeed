<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { parseBackup, serializeBackup } from '../lib/backup';

  let message = $state('');
  let fileInput: HTMLInputElement;

  function exportBackup() {
    const text = serializeBackup({
      plants: store.plants,
      events: store.events,
      postponements: store.postponements
    });
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message = '已导出备份文件';
  }

  async function importBackup(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) {
      store.importData(result.data);
      message = `已恢复 ${result.data.plants.length} 盆植物、${result.data.events.length} 条记录`;
    } else {
      message = `导入失败：${result.error}`;
    }
    input.value = '';
  }
</script>

<div class="backup">
  <button class="small" onclick={exportBackup}>⬇ 导出备份</button>
  <button class="small" onclick={() => fileInput.click()}>⬆ 导入备份</button>
  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.json"
    hidden
    onchange={importBackup}
  />
  {#if message}<span class="msg">{message}</span>{/if}
</div>

<style>
  .backup { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .msg { font-size: 12px; color: var(--muted); }
</style>
