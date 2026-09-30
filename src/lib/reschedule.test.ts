import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { applyCompletion, rescheduleCourse, undoLastCompletion } from './mutations'
import { buildDayPlan, buildStudyPlan, getChapterViews, getCourseStats } from './planning'
import { loadState, saveState } from './storage'
import type { Chapter, Course, PlannerState, Proficiency } from './types'

const TODAY = '2026-10-01'

function makeState(): PlannerState {
  const course: Course = {
    id: 'course-1',
    name: '数据结构',
    examDate: addDays(TODAY, 6),
    color: '#2563eb',
  }
  const chapters: Chapter[] = [
    { id: 'chapter-1', courseId: course.id, title: '线性表', order: 1, proficiency: 2 as Proficiency, completedUnits: 0 },
    { id: 'chapter-2', courseId: course.id, title: '树与二叉树', order: 2, proficiency: 1 as Proficiency, completedUnits: 0 },
  ]
  return { version: 1, courses: [course], chapters, records: [], absences: [] }
}

function totalAssigned(plan: ReturnType<typeof buildStudyPlan>): number {
  return plan.coursePlans.reduce((sum, coursePlan) => sum + coursePlan.assignments.length, 0)
}

describe('考试改期', () => {
  it('延后考试后按新的剩余天数重算未完成复习块', () => {
    const state = makeState()
 // 剩余 4 + 5 = 9 块，6 个学习日
    const before = buildStudyPlan(state, TODAY)
    expect(before.coursePlans[0].studyDates).toHaveLength(6)
    expect(totalAssigned(before)).toBe(9)

    expect(rescheduleCourse(state, 'course-1', addDays(TODAY, 12))).toBe(true)
    const after = buildStudyPlan(state, TODAY)

    expect(after.coursePlans[0].studyDates).toHaveLength(12)
    expect(totalAssigned(after)).toBe(9)
    expect(after.coursePlans[0].overloaded).toBe(false)
  })

  it('提前考试后未完成块被压缩到更少的学习日，已完成内容不重新进入计划', () => {
    const state = makeState()
    applyCompletion(state, 'chapter-1', TODAY)
    applyCompletion(state, 'chapter-1', TODAY)
    applyCompletion(state, 'chapter-1', TODAY)
    // chapter-1 已完成 3/4，剩 1；chapter-2 剩 5，共 6 块未完成
    expect(rescheduleCourse(state, 'course-1', addDays(TODAY, 2))).toBe(true)
    const plan = buildStudyPlan(state, TODAY)

    expect(plan.coursePlans[0].studyDates).toHaveLength(2)
    expect(totalAssigned(plan)).toBe(6)
    expect(plan.coursePlans[0].overloaded).toBe(true)
    const chapter1Assignments = plan.coursePlans[0].assignments.filter((item) => item.chapterId === 'chapter-1')
    expect(chapter1Assignments).toHaveLength(1)
  })

  it('改期保留课程、章节、熟练度、缺席日与全部完成记录', () => {
    const state = makeState()
    applyCompletion(state, 'chapter-1', TODAY)
    applyCompletion(state, 'chapter-2', TODAY)
    state.absences.push({ id: 'absence-1', date: addDays(TODAY, 1), reason: '身体不适' })
    const recordsBefore = state.records.map((record) => ({ ...record }))
    const statsBefore = getCourseStats(state, TODAY)[0]

    rescheduleCourse(state, 'course-1', addDays(TODAY, 10))

    expect(state.records).toEqual(recordsBefore)
    expect(state.absences).toHaveLength(1)
    expect(state.chapters.map((chapter) => chapter.proficiency)).toEqual([2, 1])
    const statsAfter = getCourseStats(state, TODAY)[0]
    expect(statsAfter.completedUnits).toBe(statsBefore.completedUnits)
    expect(statsAfter.totalUnits).toBe(statsBefore.totalUnits)
    expect(statsAfter.daysLeft).toBe(10)
  })

  it('改期后缺席日仍然被排除在排期之外', () => {
    const state = makeState()
    const absentDate = addDays(TODAY, 8)
    state.absences.push({ id: 'absence-1', date: absentDate, reason: '社团活动' })

    rescheduleCourse(state, 'course-1', addDays(TODAY, 12))
    const plan = buildStudyPlan(state, TODAY)

    expect(plan.coursePlans[0].studyDates).not.toContain(absentDate)
    expect(plan.coursePlans[0].studyDates).toHaveLength(11)
    const absentDay = buildDayPlan(state, plan, absentDate)
    expect(absentDay.items).toHaveLength(0)
    expect(absentDay.absence?.reason).toBe('社团活动')
    expect(totalAssigned(plan)).toBe(9)
  })

  it('取消改期等价于不调用改期，状态完全不变', () => {
    const state = makeState()
    applyCompletion(state, 'chapter-1', TODAY)
    const snapshot = JSON.parse(JSON.stringify(state))
    // 取消分支不产生任何状态变化
    expect(state).toEqual(snapshot)
    expect(rescheduleCourse(state, 'course-1', '')).toBe(false)
    expect(rescheduleCourse(state, 'missing-course', addDays(TODAY, 3))).toBe(false)
    expect(state).toEqual(snapshot)
  })
})

describe('完成记录与撤销', () => {
  it('撤销至零后进度归零，且可以继续完成新块', () => {
    const state = makeState()
    applyCompletion(state, 'chapter-1', TODAY)
    applyCompletion(state, 'chapter-1', TODAY)
    expect(getChapterViews(state, TODAY).find((view) => view.chapter.id === 'chapter-1')?.completedUnits).toBe(2)

    expect(undoLastCompletion(state, 'chapter-1')).toBe(true)
    expect(undoLastCompletion(state, 'chapter-1')).toBe(true)
    expect(undoLastCompletion(state, 'chapter-1')).toBe(false)

    const view = getChapterViews(state, TODAY).find((item) => item.chapter.id === 'chapter-1')
    expect(view?.completedUnits).toBe(0)
    expect(view?.progress).toBe(0)
    expect(view?.remainingUnits).toBe(4)
    expect(state.chapters[0].completedUnits).toBe(0)
    expect(state.records).toHaveLength(0)

    expect(applyCompletion(state, 'chapter-1', TODAY)).toBe(true)
    expect(getChapterViews(state, TODAY).find((item) => item.chapter.id === 'chapter-1')?.completedUnits).toBe(1)
  })

  it('章节卡片、课程统计与排期共用记录作为唯一完成量来源', () => {
    const state = makeState()
    state.chapters[0].completedUnits = 3 // 模拟未同步的旧字段
    applyCompletion(state, 'chapter-1', TODAY) // 只新增 1 条记录

    const view = getChapterViews(state, TODAY).find((item) => item.chapter.id === 'chapter-1')
    expect(view?.completedUnits).toBe(1)
    expect(state.chapters[0].completedUnits).toBe(1)
    expect(getCourseStats(state, TODAY)[0].completedUnits).toBe(1)
    expect(buildStudyPlan(state, TODAY).coursePlans[0].remainingUnits).toBe(8)
  })
})

describe('本地持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('改期与完成记录在保存并重新加载后保持一致', () => {
    const state = makeState()
    applyCompletion(state, 'chapter-1', TODAY)
    state.absences.push({ id: 'absence-1', date: addDays(TODAY, 2), reason: '临时安排' })
    rescheduleCourse(state, 'course-1', addDays(TODAY, 9))
    saveState(state)

    const loaded = loadState()
    expect(loaded.courses[0].examDate).toBe(addDays(TODAY, 9))
    expect(loaded.records).toHaveLength(1)
    expect(loaded.absences).toHaveLength(1)
    const view = getChapterViews(loaded, TODAY).find((item) => item.chapter.id === 'chapter-1')
    expect(view?.completedUnits).toBe(1)
    expect(view?.remainingUnits).toBe(3)
  })

  it('兼容只有章节 completedUnits、没有记录的旧数据，迁移后可撤销至零', () => {
    const legacy = {
      version: 1,
      courses: [{ id: 'course-1', name: '旧课程', examDate: addDays(TODAY, 6), color: '#2563eb' }],
      chapters: [
        { id: 'chapter-1', courseId: 'course-1', title: '旧章节', order: 1, proficiency: 2, completedUnits: 2 },
      ],
      records: [],
      absences: [],
    }
    localStorage.setItem('course-review-planner:v1', JSON.stringify(legacy))

    const loaded = loadState()
    expect(loaded.records).toHaveLength(1)
    expect(loaded.records[0].units).toBe(2)
    expect(loaded.chapters[0].completedUnits).toBe(2)
    expect(getChapterViews(loaded, TODAY).find((item) => item.chapter.id === 'chapter-1')?.completedUnits).toBe(2)

    expect(undoLastCompletion(loaded, 'chapter-1')).toBe(true)
    expect(getChapterViews(loaded, TODAY).find((item) => item.chapter.id === 'chapter-1')?.completedUnits).toBe(0)
    expect(loaded.chapters[0].completedUnits).toBe(0)
    expect(undoLastCompletion(loaded, 'chapter-1')).toBe(false)
  })
})
