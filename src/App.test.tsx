import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

describe('App 渲染冒烟', () => {
  it('首页渲染标题与各功能页签', () => {
    const html = renderToString(<App />);
    for (const text of ['捐赠物资分拣台', '库存总览', '入库登记', '发放出库', '批次追溯', '收发记录']) {
      expect(html).toContain(text);
    }
  });

  it('演示数据渲染库存表格与临期提示', () => {
    const html = renderToString(<App />);
    expect(html).toContain('矿泉水');
    expect(html).toContain('临期');
  });
});
