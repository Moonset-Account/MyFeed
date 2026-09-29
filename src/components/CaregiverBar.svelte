<script lang="ts">
  import type { Caregiver } from '../lib/types';

  interface Props {
    caregivers: Caregiver[];
    onAdd: (name: string) => void;
  }
  let { caregivers, onAdd }: Props = $props();

  let name = $state('');

  function add() {
    const n = name.trim();
    if (!n) return;
    onAdd(n);
    name = '';
  }
</script>

<div class="caregivers">
  <span class="label">👥 照护人</span>
  {#each caregivers as c (c.id)}
    <span class="chip">{c.name}</span>
  {/each}
  <input
    bind:value={name}
    placeholder="添加成员"
    onkeydown={(e) => e.key === 'Enter' && add()}
  />
  <button class="btn ghost" onclick={add}>添加</button>
</div>
