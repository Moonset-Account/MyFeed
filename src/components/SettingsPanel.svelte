<script lang="ts">
  import { resetAll, appState, updateSettings } from '../lib/store';

  $: s = $appState.settings;

  function apply(field: 'tableCount' | 'seatsPerTable' | 'accessiblePerTable', raw: string) {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    const next = { ...s, [field]: value };
    if (field === 'tableCount') next.tableCount = Math.max(1, Math.min(50, value));
    if (field === 'seatsPerTable') next.seatsPerTable = Math.max(1, Math.min(30, value));
    next.accessiblePerTable = Math.min(next.accessiblePerTable, next.seatsPerTable);
    updateSettings(next);
  }

  function clearAll() {
    if (confirm('确定清空全部宾客、座位安排与设置吗？此操作可用“撤销上一步”恢复一次。')) {
      resetAll();
    }
  }
</script>

<section class="panel">
  <h2>宴席设置</h2>
  <div class="grid">
    <label>
      桌数
      <input
        type="number"
        min="1"
        max="50"
        value={s.tableCount}
        on:change={(e) => apply('tableCount', e.currentTarget.value)}
      />
    </label>
    <label>
      每桌座位数
      <input
        type="number"
        min="1"
        max="30"
        value={s.seatsPerTable}
        on:change={(e) => apply('seatsPerTable', e.currentTarget.value)}
      />
    </label>
    <label>
      每桌无障碍座位
      <input
        type="number"
        min="0"
        max={s.seatsPerTable}
        value={s.accessiblePerTable}
        on:change={(e) => apply('accessiblePerTable', e.currentTarget.value)}
      />
    </label>
  </div>
  <p class="hint">缩小桌数或座位数不会删除安排，超出的宾客会标记为“超员”。</p>
  <button class="danger" on:click={clearAll}>清空全部数据</button>
</section>

<style>
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 16px;
  }
  h2 { font-size: 16px; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--muted); }
  input { width: 100%; }
  .hint { font-size: 12px; color: var(--muted); margin: 10px 0; }
</style>
