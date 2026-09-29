<script lang="ts">
  import { conflicts } from '../lib/store';

  const labels: Record<string, string> = {
    capacity: '超员',
    avoid: '需避开',
    together: '同行',
    accessible: '无障碍',
  };
</script>

<section class="panel conflicts">
  <h2>
    冲突提示
    {#if $conflicts.length > 0}<span class="count">{$conflicts.length}</span>{/if}
  </h2>
  {#if $conflicts.length === 0}
    <p class="ok-text">暂无冲突，当前安排合理。</p>
  {:else}
    <ul>
      {#each $conflicts as c, i (i)}
        <li class="conflict-item {c.type}">
          <span class="tag">{labels[c.type] ?? c.type}</span>
          <span>{c.message}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
