<script lang="ts">
  import { CATEGORY_META, CATEGORY_ORDER } from '../lib/logic';
  import type { CareTask, Pet, TaskCategory } from '../lib/types';

  interface Props {
    pets: Pet[];
    defaultDate: string;
    onAdd: (task: CareTask) => void;
  }
  let { pets, defaultDate, onAdd }: Props = $props();

  let open = $state(false);
  let petId = $state('');
  let category = $state<TaskCategory>('feeding');
  let title = $state('');
  let date = $state('');
  let time = $state('08:00');
  let detail = $state('');

  $effect(() => {
    if (!petId && pets.length > 0) petId = pets[0].id;
  });

  function toggle() {
    open = !open;
    if (open) date = defaultDate;
  }

  function submit() {
    if (!petId || !date || !time) return;
    const finalTitle = title.trim() || CATEGORY_META[category].label;
    onAdd({
      id: `task-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      petId,
      category,
      title: finalTitle,
      date,
      time,
      detail: detail.trim() || undefined,
    });
    title = '';
    detail = '';
    open = false;
  }
</script>

<section class="add-task">
  {#if !open}
    <button class="btn ghost add-toggle" onclick={toggle}>＋ 安排新事项</button>
  {:else}
    <form
      class="add-form"
      onsubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h3>安排新事项</h3>
      <div class="form-grid">
        <label>
          宠物
          <select bind:value={petId}>
            {#each pets as p (p.id)}
              <option value={p.id}>{p.avatar} {p.name}</option>
            {/each}
          </select>
        </label>
        <label>
          类别
          <select bind:value={category}>
            {#each CATEGORY_ORDER as c}
              <option value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
            {/each}
          </select>
        </label>
        <label>
          日期
          <input type="date" bind:value={date} required />
        </label>
        <label>
          时间
          <input type="time" bind:value={time} required />
        </label>
        <label class="span-2">
          事项
          <input bind:value={title} placeholder="如：晚餐：猫粮 35g（留空则使用类别名）" />
        </label>
        <label class="span-2">
          说明（可选）
          <input bind:value={detail} placeholder="注意事项、用量等" />
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" onclick={toggle}>取消</button>
        <button type="submit" class="btn primary">添加事项</button>
      </div>
    </form>
  {/if}
</section>
