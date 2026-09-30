import { todayISO } from './dates'
import { completedOn } from './planning'
import { createId } from './storage'
import type { PlannerState } from './types'

function syncChapterCompleted(state: PlannerState, chapterId: string): void {
  const chapter = state.chapters.find((item) => item.id === chapterId)
  if (chapter) chapter.completedUnits = completedOn(state, chapterId)
}

export function applyCompletion(state: PlannerState, chapterId: string, date = todayISO()): boolean {
  const chapter = state.chapters.find((item) => item.id === chapterId)
  if (!chapter) return false
  state.records.push({
    id: createId('record'),
    chapterId,
    courseId: chapter.courseId,
    date,
    units: 1,
    createdAt: new Date().toISOString(),
  })
  syncChapterCompleted(state, chapterId)
  return true
}

export function undoLastCompletion(state: PlannerState, chapterId: string): boolean {
  const index = [...state.records].reverse().findIndex((record) => record.chapterId === chapterId)
  if (index === -1) return false
  state.records.splice(state.records.length - 1 - index, 1)
  syncChapterCompleted(state, chapterId)
  return true
}

export function rescheduleCourse(state: PlannerState, courseId: string, newExamDate: string): boolean {
  const course = state.courses.find((item) => item.id === courseId)
  if (!course || !newExamDate) return false
  course.examDate = newExamDate
  return true
}
