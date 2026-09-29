import type { Absence, Chapter, Course, PlannerState, Proficiency, ReviewRecord } from './types'
import { addDays, todayISO } from './dates'

const STORAGE_KEY = 'course-review-planner:v1'

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createSampleState(): PlannerState {
  const today = todayISO()
  const math: Course = {
    id: 'course-math',
    name: '高等数学',
    examDate: addDays(today, 12),
    color: '#2563eb',
  }
  const english: Course = {
    id: 'course-english',
    name: '大学英语',
    examDate: addDays(today, 18),
    color: '#059669',
  }
  const courses = [math, english]

  const chapters: Chapter[] = [
    { id: 'chapter-math-1', courseId: math.id, title: '极限与连续', order: 1, proficiency: 2, completedUnits: 1 },
    { id: 'chapter-math-2', courseId: math.id, title: '导数应用', order: 2, proficiency: 1, completedUnits: 0 },
    { id: 'chapter-math-3', courseId: math.id, title: '定积分', order: 3, proficiency: 3, completedUnits: 0 },
    { id: 'chapter-english-1', courseId: english.id, title: '阅读长难句', order: 1, proficiency: 3, completedUnits: 0 },
    { id: 'chapter-english-2', courseId: english.id, title: '写作模板', order: 2, proficiency: 2, completedUnits: 0 },
  ]

  const records: ReviewRecord[] = [
    {
      id: 'record-seed-1',
      chapterId: 'chapter-math-1',
      courseId: math.id,
      date: addDays(today, -1),
      units: 1,
      createdAt: new Date().toISOString(),
    },
  ]

  return {
    version: 1,
    courses,
    chapters,
    records,
    absences: [],
  }
}

function normalizeProficiency(value: unknown): Proficiency {
  const number = Number(value)
  return ([1, 2, 3, 4, 5].includes(number) ? number : 3) as Proficiency
}

function normalizeState(value: Partial<PlannerState> | null | undefined): PlannerState {
  const fallback = createSampleState()
  if (!value || typeof value !== 'object') return fallback

  const courses: Course[] = Array.isArray(value.courses)
    ? value.courses
        .filter((item): item is Course => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string'))
        .map((item) => ({
          id: item.id,
          name: item.name,
          examDate: typeof item.examDate === 'string' ? item.examDate : addDays(todayISO(), 14),
          color: typeof item.color === 'string' ? item.color : '#2563eb',
        }))
    : fallback.courses

  const courseIds = new Set(courses.map((course) => course.id))
  const chapters: Chapter[] = Array.isArray(value.chapters)
    ? value.chapters
        .filter((item): item is Chapter => Boolean(item && typeof item.id === 'string' && courseIds.has(item.courseId)))
        .map((item, index) => ({
          id: item.id,
          courseId: item.courseId,
          title: typeof item.title === 'string' && item.title.trim() ? item.title : `章节 ${index + 1}`,
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
          proficiency: normalizeProficiency(item.proficiency),
          completedUnits: Math.max(0, Number(item.completedUnits) || 0),
        }))
    : fallback.chapters

  const chapterIds = new Set(chapters.map((chapter) => chapter.id))
  const records: ReviewRecord[] = Array.isArray(value.records)
    ? value.records
        .filter(
          (item): item is ReviewRecord =>
            Boolean(item && typeof item.id === 'string' && chapterIds.has(item.chapterId)),
        )
        .map((item) => ({
          id: item.id,
          chapterId: item.chapterId,
          courseId: item.courseId,
          date: typeof item.date === 'string' ? item.date : todayISO(),
          units: Math.max(1, Math.round(Number(item.units) || 1)),
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        }))
    : fallback.records

  const absences: Absence[] = Array.isArray(value.absences)
    ? value.absences
        .filter((item): item is Absence => Boolean(item && typeof item.id === 'string' && typeof item.date === 'string'))
        .map((item) => ({
          id: item.id,
          date: item.date,
          reason: typeof item.reason === 'string' ? item.reason : '',
        }))
    : fallback.absences

  return { version: 1, courses, chapters, records, absences }
}

export function loadState(): PlannerState {
  if (typeof localStorage === 'undefined') return createSampleState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeState(raw ? (JSON.parse(raw) as Partial<PlannerState>) : null)
  } catch {
    return createSampleState()
  }
}

export function saveState(state: PlannerState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearSavedState(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
