import type {
  Assignment,
  Chapter,
  ChapterView,
  Course,
  CoursePlan,
  CourseStat,
  DayPlan,
  PlannerState,
  Proficiency,
  StudyPlan,
} from './types'
import { addDays, datesBetween, diffDays, todayISO } from './dates'

export const MINUTES_PER_UNIT = 30

export const PROFICIENCY_LOAD: Record<Proficiency, number> = {
  1: 5,
  2: 4,
  3: 3,
  4: 2,
  5: 1,
}

export const PROFICIENCY_LABEL: Record<Proficiency, string> = {
  1: '生疏',
  2: '需巩固',
  3: '基本掌握',
  4: '较熟练',
  5: '有把握',
}

export function totalUnitsForProficiency(proficiency: Proficiency): number {
  return PROFICIENCY_LOAD[proficiency]
}

export function completedOn(state: Pick<PlannerState, 'records'>, chapterId: string): number {
  return state.records
    .filter((record) => record.chapterId === chapterId)
    .reduce((sum, record) => sum + record.units, 0)
}

export function remainingUnits(chapter: Chapter, completed = chapter.completedUnits): number {
  return Math.max(0, totalUnitsForProficiency(chapter.proficiency) - completed)
}

export function createChapterView(
  chapter: Chapter,
  completed: number,
  course?: Course,
): ChapterView {
  const totalUnits = totalUnitsForProficiency(chapter.proficiency)
  const safeCompleted = Math.min(completed, totalUnits)
  return {
    chapter,
    course,
    totalUnits,
    completedUnits: safeCompleted,
    remainingUnits: Math.max(0, totalUnits - safeCompleted),
    progress: totalUnits === 0 ? 100 : Math.round((safeCompleted / totalUnits) * 100),
  }
}

export function getChapterViews(state: PlannerState, today = todayISO()): ChapterView[] {
  const courseMap = new Map(state.courses.map((course) => [course.id, course]))
  return state.chapters
    .map((chapter) => {
      const completed = completedOn(state, chapter.id)
      return createChapterView(chapter, completed, courseMap.get(chapter.courseId))
    })
    .filter((view) => {
      if (!view.course) return true
      return diffDays(today, view.course.examDate) >= 0 || view.remainingUnits > 0
    })
    .sort((a, b) => {
      const dateA = a.course?.examDate ?? '9999-12-31'
      const dateB = b.course?.examDate ?? '9999-12-31'
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      if (a.remainingUnits !== b.remainingUnits) return b.remainingUnits - a.remainingUnits
      return a.chapter.order - b.chapter.order
    })
}

export function getCourseStats(state: PlannerState, today = todayISO()): CourseStat[] {
  const views = getChapterViews(state, today)
  return state.courses
    .map((course) => {
      const courseViews = views.filter((view) => view.chapter.courseId === course.id)
      const totalUnits = courseViews.reduce((sum, view) => sum + view.totalUnits, 0)
      const completedUnits = courseViews.reduce((sum, view) => sum + view.completedUnits, 0)
      const remainingUnits = Math.max(0, totalUnits - completedUnits)
      const daysLeft = diffDays(today, course.examDate)
      const progress = totalUnits === 0 ? 100 : Math.round((completedUnits / totalUnits) * 100)
      const status: CourseStat['status'] =
        remainingUnits === 0
          ? 'completed'
          : daysLeft < 0
            ? 'overdue'
            : daysLeft === 0
              ? 'today'
              : 'upcoming'
      return {
        course,
        totalUnits,
        completedUnits,
        remainingUnits,
        chapterCount: courseViews.length,
        daysLeft,
        progress,
        status,
      }
    })
    .sort((a, b) => a.course.examDate.localeCompare(b.course.examDate))
}

function getStudyDates(course: Course, absenceDates: Set<string>, today: string): string[] {
  const lastStudyDate = addDays(course.examDate, -1)
  return datesBetween(today, lastStudyDate).filter((date) => !absenceDates.has(date))
}

function chapterPriority(a: ChapterView, b: ChapterView): number {
  if (a.remainingUnits !== b.remainingUnits) return b.remainingUnits - a.remainingUnits
  if (a.chapter.proficiency !== b.chapter.proficiency) {
    return a.chapter.proficiency - b.chapter.proficiency
  }
  return a.chapter.order - b.chapter.order
}

export function buildStudyPlan(state: PlannerState, today = todayISO()): StudyPlan {
  const absenceDates = new Set(state.absences.map((absence) => absence.date))
  const courseMap = new Map(state.courses.map((course) => [course.id, course]))
  const allViews = getChapterViews(state, today)
  const assignmentsByDate = new Map<string, Assignment[]>()
  const coursePlans: CoursePlan[] = []
  const overdueChapters: ChapterView[] = []

  for (const course of state.courses) {
    const views = allViews
      .filter((view) => view.chapter.courseId === course.id && view.remainingUnits > 0)
      .sort(chapterPriority)
    const remainingUnits = views.reduce((sum, view) => sum + view.remainingUnits, 0)

    if (diffDays(today, course.examDate) < 0) {
      overdueChapters.push(...views)
      coursePlans.push({
        course,
        studyDates: [],
        assignments: [],
        remainingUnits,
        overdueUnits: remainingUnits,
        overloaded: remainingUnits > 0,
      })
      continue
    }

    const studyDates = getStudyDates(course, absenceDates, today)
    if (studyDates.length === 0) {
      overdueChapters.push(...views)
      coursePlans.push({
        course,
        studyDates: [],
        assignments: [],
        remainingUnits,
        overdueUnits: remainingUnits,
        overloaded: remainingUnits > 0,
      })
      continue
    }

    const assignments: Assignment[] = []
    const dateLoads = studyDates.map(() => 0)

    for (const view of views) {
      const usedDateIndexes = new Set<number>()
      for (let rank = 0; rank < view.remainingUnits; rank += 1) {
        const idealIndex = Math.floor(((rank + 0.5) * studyDates.length) / view.remainingUnits)
        let candidateIndex = 0
        let candidateScore = Number.POSITIVE_INFINITY

        for (let dateIndex = 0; dateIndex < studyDates.length; dateIndex += 1) {
          if (view.remainingUnits <= studyDates.length && usedDateIndexes.has(dateIndex)) continue
          const loadScore = dateLoads[dateIndex] * studyDates.length * 2
          const duplicateScore = usedDateIndexes.has(dateIndex) ? studyDates.length : 0
          const distanceScore = Math.abs(dateIndex - idealIndex)
          const score = loadScore + duplicateScore + distanceScore
          if (score < candidateScore) {
            candidateScore = score
            candidateIndex = dateIndex
          }
        }

        usedDateIndexes.add(candidateIndex)
        dateLoads[candidateIndex] += 1
        assignments.push({
          chapterId: view.chapter.id,
          courseId: course.id,
          date: studyDates[candidateIndex],
          units: 1,
        })
      }
    }

    for (const assignment of assignments) {
      assignmentsByDate.set(assignment.date, [
        ...(assignmentsByDate.get(assignment.date) ?? []),
        assignment,
      ])
    }

    coursePlans.push({
      course,
      studyDates,
      assignments,
      remainingUnits,
      overdueUnits: 0,
      overloaded: remainingUnits > studyDates.length,
    })
  }

  for (const items of assignmentsByDate.values()) {
    items.sort((a, b) => {
      const courseA = courseMap.get(a.courseId)
      const courseB = courseMap.get(b.courseId)
      if (courseA && courseB && courseA.examDate !== courseB.examDate) {
        return courseA.examDate.localeCompare(courseB.examDate)
      }
      return a.chapterId.localeCompare(b.chapterId)
    })
  }

  return { today, coursePlans, assignmentsByDate, overdueChapters }
}

export function buildDayPlan(
  state: PlannerState,
  plan: StudyPlan,
  date: string,
): DayPlan {
  const chapterMap = new Map(state.chapters.map((chapter) => [chapter.id, chapter]))
  const courseMap = new Map(state.courses.map((course) => [course.id, course]))
  const grouped = new Map<string, { chapter: Chapter; course: Course; units: number }>()

  for (const assignment of plan.assignmentsByDate.get(date) ?? []) {
    const chapter = chapterMap.get(assignment.chapterId)
    const course = courseMap.get(assignment.courseId)
    if (!chapter || !course) continue
    const current = grouped.get(chapter.id)
    if (current) current.units += assignment.units
    else grouped.set(chapter.id, { chapter, course, units: assignment.units })
  }

  const items = [...grouped.values()].sort((a, b) => {
    if (a.course.examDate !== b.course.examDate) {
      return a.course.examDate.localeCompare(b.course.examDate)
    }
    if (a.chapter.proficiency !== b.chapter.proficiency) {
      return a.chapter.proficiency - b.chapter.proficiency
    }
    return a.chapter.order - b.chapter.order
  })

  const totalUnits = items.reduce((sum, item) => sum + item.units, 0)
  return {
    date,
    items,
    totalUnits,
    minutes: totalUnits * MINUTES_PER_UNIT,
    absence: state.absences.find((absence) => absence.date === date),
    examCourses: state.courses.filter((course) => course.examDate === date),
  }
}

export function buildWeekPlan(state: PlannerState, plan: StudyPlan, days = 7): DayPlan[] {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(plan.today, index)
    return buildDayPlan(state, plan, date)
  })
}
