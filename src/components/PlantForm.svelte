<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { LIGHT_LABELS, type LightPosition, type Plant } from '../lib/types';

  let { plant, onClose }: { plant: Plant | null; onClose: () => void } = $props();

  const ICONS = ['🪴', '🌿', '🌵', '🌱', '🌷', '🌻', '🍀', '🌴', '🎍', '🌸'];

  let name = $state(plant?.name ?? '');
  let species = $state(plant?.species ?? '');
  let icon = $state(plant?.icon ?? ICONS[0]);
  let light = $state<LightPosition>(plant?.light ?? 'bright-indirect');
  let waterIntervalDays = $state(plant?.waterIntervalDays ?? 7);
  let fertilizeIntervalDays = $state<number | null>(plant?.fertilizeIntervalDays ?? 30);
  let error = $state('');

  function save() {
    if (!name.trim()) {
      error = '请填写植物名称';
      return;
    }
    if (!Number.isFinite(waterIntervalDays) || waterIntervalDays < 1) {
      error = '浇水间隔至少 1 天';
      return;
    }
    const payload = {
      name: name.trim(),
      species: species.trim(),
      icon,
      light,
      waterIntervalDays: Math.round(waterIntervalDays),
      fertilizeIntervalDays:
        fertilizeIntervalDays && fertilizeIntervalDays > 0
          ? Math.round(fertilizeIntervalDays)
          : null
    };
    if (plant) {
      store.updatePlant(plant.id, payload);
    } else {
      store.addPlant(payload);
    }
    onClose();
  }
</script>

<div class="mask" role="presentation" onclick={onClose} onkeydown={(e) => e.key === "Escape" && onClose()}>
  <div class="dialog" role="dialog" tabindex="-1" aria-label={plant ? "编辑植物" : "添加植物"} onclick={(e) => e.stopPropagation()}>
    <h2>{plant ? '编辑植物' : '添加植物'}</h2>

    <label class="field">
      <span>名称 *</span>
      <input bind:value={name} placeholder="例如：龟背竹" />
    </label>
    <label class="field">
      <span>品种 / 学名</span>
      <input bind:value={species} placeholder="选填" />
    </label>

    <div class="field">
      <span>照片占位图标（离线演示用图标代替照片）</span>
      <div class="icons">
        {#each ICONS as i (i)}
          <button
            type="button"
            class="icon"
            class:sel={icon === i}
            onclick={() => (icon = i)}
          >{i}</button>
        {/each}
      </div>
    </div>

    <label class="field">
      <span>光照位置</span>
      <select bind:value={light}>
        {#each Object.entries(LIGHT_LABELS) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>

    <label class="field">
      <span>浇水间隔（天）*</span>
      <input type="number" min="1" max="365" bind:value={waterIntervalDays} />
    </label>
    <label class="field">
      <span>施肥间隔（天，留空表示不跟踪）</span>
      <input
        type="number"
        min="0"
        max="365"
        value={fertilizeIntervalDays ?? ''}
        oninput={(e) => {
          const v = e.currentTarget.value;
          fertilizeIntervalDays = v === '' ? null : Number(v);
        }}
      />
    </label>

    {#if error}<p class="error">{error}</p>{/if}

    <div class="row">
      <button class="primary" onclick={save}>保存</button>
      <button onclick={onClose}>取消</button>
    </div>
  </div>
</div>

<style>
  .mask {
    position: fixed;
    inset: 0;
    background: rgba(20, 30, 24, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 10;
  }
  .dialog {
    background: var(--panel);
    border-radius: 16px;
    padding: 22px;
    width: 100%;
    max-width: 420px;
    max-height: 90vh;
    overflow: auto;
  }
  h2 { margin: 0 0 16px; font-size: 18px; }
  .icons { display: flex; gap: 6px; flex-wrap: wrap; }
  .icon {
    font-size: 22px;
    padding: 4px 8px;
    border-radius: 10px;
  }
  .icon.sel { border-color: var(--accent); background: var(--accent-soft); }
  .error { color: #a12c1f; font-size: 13px; }
  .row { display: flex; gap: 10px; margin-top: 8px; }
</style>
