import { createApp, nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.vue'
import { addDays, formatCN, todayISO } from './lib/dates'

function mountApp(): HTMLElement {
  const host = document.getElementById('app') as HTMLElement
  createApp(App).mount(host)
  return host
}

async function click(element: Element | null | undefined) {
  expect(element, 'expected element to exist').toBeTruthy()
  ;(element as HTMLElement).click()
  await nextTick()
}

async function setInputValue(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

function findByText<T extends Element>(items: T[], text: string): T | undefined {
  return items.find((item) => item.textContent?.includes(text))
}

describe('课程复习计划本界面', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('使用本地示例数据完成挂载并展示今日与周计划', async () => {
    const host = mountApp()
    await nextTick()
    await nextTick()

    expect(host.textContent).toContain('课程复习计划本')
    expect(host.textContent).toContain('今天复习什么')
    expect(host.textContent).toContain('未来 7 天周计划')
    expect(host.textContent).toContain('高等数学')
    expect(host.querySelectorAll('.app-shell > .week-plan .day-card')).toHaveLength(7)
  })

  it('从课程卡片确认改期后重算计划并保留完成记录，刷新后保持一致', async () => {
    const host = mountApp()
    await nextTick()
    const today = todayISO()
    const newExamDate = addDays(today, 20)

    const pill = findByText([...host.querySelectorAll('.course-pill')], '高等数学') as HTMLElement
    expect(pill.textContent).toContain(formatCN(addDays(today, 12)))
    await click(findByText([...pill.querySelectorAll('button')], '改期'))

    const dateInput = pill.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).toBeTruthy()
    expect(dateInput.value).toBe(addDays(today, 12))
    await setInputValue(dateInput, newExamDate)
    await click(findByText([...pill.querySelectorAll('button')], '确认改期'))

    expect(pill.textContent).toContain(formatCN(newExamDate))
    expect(pill.querySelector('input[type="date"]')).toBeNull()
    // 完成历史保留：示例数据自带的 1 条记录仍在
    expect(host.textContent).toContain('1 条')
    expect(host.textContent).toContain('极限与连续')
    // 已持久化，刷新（重新挂载）后仍是新日期
    const saved = JSON.parse(localStorage.getItem('course-review-planner:v1') ?? '{}')
    expect(saved.courses.find((course: { id: string }) => course.id === 'course-math').examDate).toBe(newExamDate)
    expect(saved.records).toHaveLength(1)

    document.body.innerHTML = '<div id="app"></div>'
    const remounted = mountApp()
    await nextTick()
    const remountedPill = findByText([...remounted.querySelectorAll('.course-pill')], '高等数学') as HTMLElement
    expect(remountedPill.textContent).toContain(formatCN(newExamDate))
  })

  it('取消改期不产生任何状态变化', async () => {
    const host = mountApp()
    await nextTick()
    const today = todayISO()
    const before = localStorage.getItem('course-review-planner:v1')

    const pill = findByText([...host.querySelectorAll('.course-pill')], '大学英语') as HTMLElement
    await click(findByText([...pill.querySelectorAll('button')], '改期'))
    const dateInput = pill.querySelector('input[type="date"]') as HTMLInputElement
    await setInputValue(dateInput, addDays(today, 30))
    await click(findByText([...pill.querySelectorAll('button')], '取消'))

    expect(pill.querySelector('input[type="date"]')).toBeNull()
    expect(pill.textContent).toContain(formatCN(addDays(today, 18)))
    expect(localStorage.getItem('course-review-planner:v1')).toBe(before)
  })

  it('示例数据撤销最后一条完成记录后进度归零，且可以继续完成新块', async () => {
    const host = mountApp()
    await nextTick()

    const card = findByText([...host.querySelectorAll('.chapter-card')], '极限与连续') as HTMLElement
    expect(card.querySelector('.progress-ring__inner strong')?.textContent).toBe('25%')

    const undoButton = findByText([...card.querySelectorAll('button')], '撤销一块') as HTMLButtonElement
    const completeButton = findByText([...card.querySelectorAll('button')], '完成一块') as HTMLButtonElement
    expect(undoButton.disabled).toBe(false)

    await click(undoButton)
    expect(card.querySelector('.progress-ring__inner strong')?.textContent).toBe('0%')
    expect(card.textContent).toContain('0/4块')
    expect(undoButton.disabled).toBe(true)
    expect(completeButton.disabled).toBe(false)

    const saved = JSON.parse(localStorage.getItem('course-review-planner:v1') ?? '{}')
    expect(saved.records).toHaveLength(0)
    expect(saved.chapters.find((chapter: { id: string }) => chapter.id === 'chapter-math-1').completedUnits).toBe(0)

    await click(completeButton)
    expect(card.querySelector('.progress-ring__inner strong')?.textContent).toBe('25%')
    expect(undoButton.disabled).toBe(false)
  })
})
