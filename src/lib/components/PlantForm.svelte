<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LightLocation, Plant } from '../types';
  import { readFileAsDataURL } from '../files';
  import { isValidISODate, todayISODate } from '../dates';

  export let plant: Plant | undefined = undefined;

  interface PlantDraft {
    id?: string;
    name: string;
    species: string;
    lightLocation: LightLocation;
    waterIntervalDays: number;
    fertilizeIntervalDays: number | undefined;
    repotIntervalDays: number | undefined;
    notes: string;
    photoDataUrl?: string;
    lastWateredDate?: string;
    lastFertilizedDate?: string;
    lastRepottedDate?: string;
  }

  const dispatch = createEventDispatcher<{ save: PlantDraft; cancel: undefined }>();

  const lightLocations: LightLocation[] = [
    '东向阳台',
    '南向阳台',
    '西向阳台',
    '北向阳台',
    '半阴处',
    '室内窗台'
  ];

  let name = plant?.name ?? '';
  let species = plant?.species ?? '';
  let lightLocation: LightLocation = plant?.lightLocation ?? '南向阳台';
  let waterIntervalDays = plant?.waterIntervalDays ?? 5;
  let fertilizeIntervalDays = plant?.fertilizeIntervalDays ?? undefined;
  let repotIntervalDays = plant?.repotIntervalDays ?? undefined;
  let notes = plant?.notes ?? '';
  let lastWateredDate = '';
  let lastFertilizedDate = '';
  let lastRepottedDate = '';
  let photoDataUrl = plant?.photoDataUrl;
  let createdAt = plant?.createdAt ?? todayISODate();
  let error = '';
  let photoLoading = false;

  function numberOrUndefined(value: number | undefined): number | undefined {
    return value && Number.isInteger(value) && value > 0 ? value : undefined;
  }

  async function handlePhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    photoLoading = true;
    error = '';
    try {
      photoDataUrl = await readFileAsDataURL(file);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : '照片读取失败。';
    } finally {
      photoLoading = false;
      input.value = '';
    }
  }

  function clearPhoto(): void {
    photoDataUrl = undefined;
  }

  function validateOptionalCareDate(label: string, value: string): boolean {
    if (!value) return true;
    if (!isValidISODate(value) || value > todayISODate()) {
      error = `${label}需要是今天或更早的有效日期。`;
      return false;
    }
    return true;
  }

  function submit(): void {
    error = '';
    const trimmedName = name.trim();
    if (!trimmedName) {
      error = '请填写植物名称。';
      return;
    }
    if (!Number.isInteger(waterIntervalDays) || waterIntervalDays < 1 || waterIntervalDays > 365) {
      error = '浇水间隔需要是 1 到 365 天之间的整数。';
      return;
    }
    if (fertilizeIntervalDays !== undefined && fertilizeIntervalDays < 1) {
      error = '施肥间隔需要大于 0，或留空。';
      return;
    }
    if (repotIntervalDays !== undefined && repotIntervalDays < 1) {
      error = '换盆间隔需要大于 0，或留空。';
      return;
    }
    if (!validateOptionalCareDate('上次浇水日期', lastWateredDate)) return;
    if (!validateOptionalCareDate('上次施肥日期', lastFertilizedDate)) return;
    if (!validateOptionalCareDate('上次换盆日期', lastRepottedDate)) return;

    dispatch('save', {
      id: plant?.id,
      name: trimmedName,
      species: species.trim(),
      lightLocation,
      waterIntervalDays,
      fertilizeIntervalDays: numberOrUndefined(fertilizeIntervalDays),
      repotIntervalDays: numberOrUndefined(repotIntervalDays),
      notes: notes.trim(),
      photoDataUrl,
      lastWateredDate: lastWateredDate || undefined,
      lastFertilizedDate: lastFertilizedDate || undefined,
      lastRepottedDate: lastRepottedDate || undefined
    });
  }
</script>

<form class="plant-form" on:submit|preventDefault={submit}>
  <div class="form-grid">
    <label>
      <span>植物名称 *</span>
      <input bind:value={name} placeholder="例如：客厅绿萝" maxlength="40" />
    </label>

    <label>
      <span>品种</span>
      <input bind:value={species} placeholder="例如：绿萝" maxlength="40" />
    </label>

    <label>
      <span>光照位置</span>
      <select bind:value={lightLocation}>
        {#each lightLocations as location}
          <option value={location}>{location}</option>
        {/each}
      </select>
    </label>

    <label>
      <span>浇水间隔（天）*</span>
      <input bind:value={waterIntervalDays} type="number" min="1" max="365" required />
    </label>

    <label>
      <span>施肥间隔（天，可留空）</span>
      <input bind:value={fertilizeIntervalDays} type="number" min="1" max="365" />
    </label>

    <label>
      <span>换盆间隔（天，可留空）</span>
      <input bind:value={repotIntervalDays} type="number" min="1" max="3650" />
    </label>
  </div>

  <label class="created-date">
    <span>建档日期</span>
    <input bind:value={createdAt} type="date" disabled />
  </label>

  {#if !plant}
    <fieldset class="initial-dates">
      <legend>最近一次实际养护（可留空，留空时从建档日期开始排期）</legend>
      <div class="form-grid">
        <label>
          <span>上次浇水</span>
          <input bind:value={lastWateredDate} type="date" max={todayISODate()} />
        </label>
        <label>
          <span>上次施肥</span>
          <input bind:value={lastFertilizedDate} type="date" max={todayISODate()} />
        </label>
        <label>
          <span>上次换盆</span>
          <input bind:value={lastRepottedDate} type="date" max={todayISODate()} />
        </label>
      </div>
    </fieldset>
  {/if}

  <label>
    <span>养护备注</span>
    <textarea bind:value={notes} rows="3" placeholder="土壤偏好、叶片状态、遮雨位置等"></textarea>
  </label>

  <div class="photo-editor">
    {#if photoDataUrl}
      <img src={photoDataUrl} alt="植物照片预览" />
    {:else}
      <div class="photo-placeholder" aria-hidden="true">
        <span>植物照片</span>
        <small>本地占位图</small>
      </div>
    {/if}
    <div class="photo-actions">
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" on:change={handlePhoto} />
      <button type="button" class="ghost" on:click={clearPhoto} disabled={!photoDataUrl}>移除照片</button>
      <p>{photoLoading ? '正在读取照片…' : '照片仅保存在本机，并会包含在 JSON 备份中。'}</p>
    </div>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  <div class="modal-actions">
    <button type="button" class="ghost" on:click={() => dispatch('cancel')}>取消</button>
    <button type="submit">{plant ? '保存修改' : '添加植物'}</button>
  </div>
</form>
