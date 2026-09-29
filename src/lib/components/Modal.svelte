<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  const dispatch = createEventDispatcher<{ close: undefined }>();

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') dispatch('close');
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div class="modal-backdrop" role="presentation" on:click={() => dispatch('close')}>
  <div class="modal-card" role="dialog" aria-modal="true" aria-label={title} on:click|stopPropagation>
    <header>
      <h2>{title}</h2>
      <button type="button" class="icon-button" aria-label="关闭" on:click={() => dispatch('close')}>×</button>
    </header>
    <slot />
  </div>
</div>
