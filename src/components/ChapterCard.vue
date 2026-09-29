<script setup lang="ts">
import { PROFICIENCY_LABEL } from '../lib/planning'
import type { ChapterView, Proficiency } from '../lib/types'

const props = defineProps<{
  view: ChapterView
  canUndo: boolean
}>()

const emit = defineEmits<{
  complete: [chapterId: string]
  undo: [chapterId: string]
  remove: [chapterId: string]
  proficiency: [payload: { chapterId: string; proficiency: Proficiency }]
}>()

const levels: Proficiency[] = [1, 2, 3, 4, 5]
</script>

<template>
  <article class="chapter-card" :style="{ '--course-color': view.course?.color ?? '#64748b' }">
    <div class="chapter-card__top">
      <div>
        <p v-if="view.course" class="chapter-card__course">
          <span class="color-dot"></span>{{ view.course.name }}
        </p>
        <h3>{{ view.chapter.title }}</h3>
      </div>
      <button class="icon-button" type="button" aria-label="删除章节" @click="emit('remove', view.chapter.id)">
        ×
      </button>
    </div>

    <div class="progress-ring" :style="{ background: `conic-gradient(var(--course-color) ${view.progress}%, #e2e8f0 0)` }">
      <div class="progress-ring__inner">
        <strong>{{ view.progress }}%</strong>
        <span>{{ view.completedUnits }}/{{ view.totalUnits }}块</span>
      </div>
    </div>

    <label class="field-inline">
      <span>熟练度</span>
      <select
        :value="view.chapter.proficiency"
        @change="emit('proficiency', { chapterId: view.chapter.id, proficiency: Number(($event.target as HTMLSelectElement).value) as Proficiency })"
      >
        <option v-for="level in levels" :key="level" :value="level">
          {{ level }} · {{ PROFICIENCY_LABEL[level] }}
        </option>
      </select>
    </label>

    <p class="chapter-card__remaining">
      <template v-if="view.remainingUnits > 0">还需 {{ view.remainingUnits }} 个复习块，约 {{ view.remainingUnits * 30 }} 分钟</template>
      <template v-else>本章已经完成复习</template>
    </p>

    <div class="chapter-card__actions">
      <button class="primary-button small" type="button" :disabled="view.remainingUnits === 0" @click="emit('complete', view.chapter.id)">
        完成一块
      </button>
      <button class="secondary-button small" type="button" :disabled="!props.canUndo" @click="emit('undo', view.chapter.id)">
        撤销一块
      </button>
    </div>
  </article>
</template>
