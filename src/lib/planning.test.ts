import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { buildDayPlan, buildStudyPlan, buildWeekPlan, getCourseStats, remainingUnits } from './planning'
import type { Chapter, Course, PlannerState, Proficiency } from './types'

function makeState(today: string, options: { absenceAtOffset?: number; completed?: number } = {}): PlannerState {
  const course: Course = {
    id: 'course-1',
    name: '测试课程',
    examDate: addDays(today, 9),
    color: '#2563eb',
  }
  const chapters: Chapter[] = [
    { id: 'chapter-1', courseId: course.id, title: '第一章', order: 1, proficiency: 2 as Proficiency, completedUnits: options.completed ?? 0 },
    { id: 'chapter-2', courseId: course.id, title: '第二章', order: 2, proficiency: 1 as Proficiency, completedUnits: 0 },
  ]
  return {
    version: 1,
    courses: [course],
    chapters,
    records: [],
    absences:
      options.absenceAtOffset === undefined
        ? []
        : [
            {
              id: 'absence-1',
              date: addDays(today, options.absenceAtOffset),
              reason: '临时缺席',
            },
          ],
  }
}

describe('复习计划算法', () => {
  it('按熟练度计算剩余复习量', () => {
    const state = makeState('2026-10-01')
    expect(remainingUnits(state.chapters[0])).toBe(4)
    expect(remainingUnits(state.chapters[1])).toBe(5)
  })

  it('将剩余复习块分配到考试前的可用日期', () => {
    const today = '2026-10-01'
    const state = makeState(today)
    const plan = buildStudyPlan(state, today)
    const coursePlan = plan.coursePlans[0]

    expect(coursePlan.studyDates).toHaveLength(9)
    expect(coursePlan.assignments).toHaveLength(9)
    expect(plan.assignmentsByDate.get(today)).toHaveLength(1)
    expect(buildDayPlan(state, plan, addDays(today, 1)).totalUnits).toBeGreaterThan(0)
  })

  it('缺席后把未完成任务安排到后续学习日，保留完成记录', () => {
    const today = '2026-10-01'
    const absentDate = addDays(today, 2)
    const state = makeState(today, { absenceAtOffset: 2 })
    const plan = buildStudyPlan(state, today)
    const absentDay = buildDayPlan(state, plan, absentDate)

    expect(plan.coursePlans[0].studyDates).not.toContain(absentDate)
    expect(absentDay.items).toHaveLength(0)
    expect(absentDay.absence?.reason).toBe('临时缺席')
    expect(plan.coursePlans[0].assignments).toHaveLength(9)
  })

  it('完成记录会减少未来剩余量且历史记录不会被缺席删除', () => {
    const today = '2026-10-01'
    const state = makeState(today, { completed: 2 })
    state.records = [
      {
        id: 'record-1',
        chapterId: 'chapter-1',
        courseId: 'course-1',
        date: addDays(today, -1),
        units: 2,
        createdAt: '2026-09-30T08:00:00.000Z',
      },
      {
        id: 'record-2',
        chapterId: 'chapter-1',
        courseId: 'course-1',
        date: today,
        units: 1,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
    ]
    const plan = buildStudyPlan(state, today)

    expect(plan.coursePlans[0].remainingUnits).toBe(6)
    expect(state.records).toHaveLength(2)
    expect(getCourseStats(state, today)[0].completedUnits).toBe(3)
  })

  it('生成七天计划并在考试当天展示课程', () => {
    const today = '2026-10-01'
    const state = makeState(today)
    state.courses[0].examDate = addDays(today, 3)
    state.chapters = state.chapters.slice(0, 1)
    const plan = buildStudyPlan(state, today)
    const week = buildWeekPlan(state, plan, 7)

    expect(week).toHaveLength(7)
    expect(week[3].examCourses[0]?.name).toBe('测试课程')
  })
})

describe('复习节奏', () => {
  it('复习块少于学习日时均匀间隔安排，而不是集中在临考前', () => {
    const today = '2026-11-01'
    const course: Course = { id: 'spaced-course', name: '长线课程', examDate: addDays(today, 20), color: '#059669' }
    const chapter: Chapter = {
      id: 'spaced-chapter',
      courseId: course.id,
      title: '综合复习',
      order: 1,
      proficiency: 4 as Proficiency,
      completedUnits: 0,
    }
    const state: PlannerState = {
      version: 1,
      courses: [course],
      chapters: [chapter],
      records: [],
      absences: [],
    }
    const plan = buildStudyPlan(state, today)
    const usedDays = [...plan.assignmentsByDate.keys()].sort()

    expect(usedDays).toHaveLength(2)
    expect(usedDays[0]).toBe(addDays(today, 5))
    expect(usedDays[1]).toBe(addDays(today, 15))
  })
})
