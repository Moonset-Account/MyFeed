<script lang="ts">
  import { actions } from '../lib/store';
  import type { Gear, Template } from '../lib/types';

  let { gears, templates }: { gears: Gear[]; templates: Template[] } = $props();

  function gearName(id: string): string {
    return gears.find((gear) => gear.id === id)?.name ?? '已删除装备';
  }
</script>

<section class="panel">
  <div class="panel-heading">
    <div>
      <p class="eyebrow">Templates</p>
      <h2>行程模板</h2>
    </div>
    <p class="muted">模板只保存装备种类、数量和充电要求，可在任意新行程中复用。</p>
  </div>

  {#if templates.length === 0}
    <div class="empty-state">暂无模板。可在准备行程时把当前分配保存为模板。</div>
  {:else}
    <div class="template-grid">
      {#each templates as template (template.id)}
        <article class="template-card">
          <header>
            <div>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
            </div>
            <button type="button" class="icon-button" aria-label="删除模板" onclick={() => {
              if (confirm(`删除模板「${template.name}」？`)) actions.deleteTemplate(template.id);
            }}>×</button>
          </header>
          <ul>
            {#each template.allocations.filter((item) => item.quantity > 0) as item (item.gearId)}
              <li>
                <span>{gearName(item.gearId)} × {item.quantity}</span>
                {#if item.charged > 0}<small>其中 {item.charged} 件需充电</small>{/if}
              </li>
            {/each}
          </ul>
          <label>
            模板名称
            <input
              value={template.name}
              onchange={(event) => actions.updateTemplate(template.id, { name: (event.currentTarget as HTMLInputElement).value })}
            />
          </label>
        </article>
      {/each}
    </div>
  {/if}
</section>
