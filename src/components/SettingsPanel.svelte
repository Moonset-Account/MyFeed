<script lang="ts">
  import { applySettings, doResetAll, doUnseatAll, seating, showToast } from '../lib/store';

  let tableCount = 6;
  let seatsPerTable = 10;
  let accessiblePerTable = 1;

  // 外部变化（如撤销）时同步输入框；仅依赖 $seating，打字过程不会被打断。
  $: if ($seating.tables.length > 0) {
    tableCount = $seating.tables.length;
    seatsPerTable = $seating.tables[0].capacity;
    accessiblePerTable = $seating.tables[0].accessibleSeats;
  }

  function clamp(value: number, min: number, max: number, fallback: number): number {
    const n = Math.floor(value);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function apply(): void {
    const seats = clamp(seatsPerTable, 2, 24, 10);
    const tables = clamp(tableCount, 1, 40, 6);
    const acc = clamp(accessiblePerTable, 0, seats, 0);
    applySettings(tables, seats, acc);
  }

  function confirmReset(): void {
    if (window.confirm('确定清空全部宾客与座位数据吗？（可用“撤销上一步”恢复）')) {
      doResetAll();
      showToast('已清空全部数据');
    }
  }
</script>

<section class="panel">
  <h2>宴席设置</h2>
  <div class="field">
    <label for="table-count">桌数</label>
    <input id="table-count" type="number" min="1" max="40" bind:value={tableCount} on:change={apply} />
  </div>
  <div class="field">
    <label for="seats-per-table">每桌座位数</label>
    <input id="seats-per-table" type="number" min="2" max="24" bind:value={seatsPerTable} on:change={apply} />
  </div>
  <div class="field">
    <label for="acc-per-table">每桌无障碍座位数</label>
    <input id="acc-per-table" type="number" min="0" max="24" bind:value={accessiblePerTable} on:change={apply} />
  </div>
  <p class="hint">每桌编号靠前的座位为无障碍座位（标记 ♿）。缩小桌数或座位数时，被裁掉的宾客会自动回到未安排名单。</p>
  <div class="btn-row">
    <button type="button" on:click={doUnseatAll}>清空入座</button>
    <button type="button" class="danger" on:click={confirmReset}>清空全部数据</button>
  </div>
</section>
