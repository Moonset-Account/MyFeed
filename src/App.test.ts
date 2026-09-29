import { createApp, nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.vue'

describe('课程复习计划本界面', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
  })

  it('使用本地示例数据完成挂载并展示今日与周计划', async () => {
    const host = document.getElementById('app') as HTMLElement
    createApp(App).mount(host)
    await nextTick()
    await nextTick()

    expect(host.textContent).toContain('课程复习计划本')
    expect(host.textContent).toContain('今天复习什么')
    expect(host.textContent).toContain('未来 7 天周计划')
    expect(host.textContent).toContain('高等数学')
    expect(host.querySelectorAll('.app-shell > .week-plan .day-card')).toHaveLength(7)
  })
})
