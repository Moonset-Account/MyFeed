# 露营装备检查册

一个完全离线使用的露营装备管理小应用，基于 Svelte + TypeScript + Vite。

## 功能

- **装备库**：按帐篷、睡眠、炉具、照明、炊具等类别维护装备，记录拥有数量、损坏数量、是否用电池及充电状态。
- **行程分配**：为一次出行选择装备与数量，自动提示缺件（可用 = 拥有 − 损坏）、损坏待修和电池未充电；无缺件才能确认出发，出发时生成清单快照。
- **归来检查**：对照出发清单逐项核对收回数量、登记新增损坏；完成后损坏写回装备库，并自动生成维修待办。
- **行程模板**：把行程的装备清单存为模板，下次一键创建同配置行程。
- **维修待办**：汇总装备损坏与手工登记的维修事项，完成维修可扣减损坏数量。
- **离线存储**：全部数据保存在浏览器 localStorage，不依赖任何外部服务或账号。首次启动会填充一份示例数据便于体验。

## 环境要求

- Node.js 24.15.x（兼容 24.x）
- 仅使用 npm

## 安装

```bash
npm install
```

## 本地启动

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

然后访问 <http://127.0.0.1:5173/>。端口被占用时命令会直接失败，请释放端口后重试。

## 测试与检查

```bash
npm test        # 单次运行核心逻辑测试（vitest）
npm run check   # Svelte / TypeScript 类型检查
npm run build   # 生产构建到 dist/
```

核心逻辑（缺件评估、出发快照、归来结算、模板复用、维修扣减）在 `src/lib/logic.ts`，对应测试在 `src/lib/logic.test.ts`。

## 目录结构

```
src/
  App.svelte                 # 顶部导航与页面切换
  lib/
    types.ts                 # 数据模型
    logic.ts                 # 纯函数业务逻辑（可测试）
    store.ts                 # localStorage 持久化 store
    logic.test.ts            # 核心逻辑测试
    components/
      InventoryPanel.svelte  # 装备库
      TripsPanel.svelte      # 行程筹备 / 出发 / 归来检查
      TemplatesPanel.svelte  # 行程模板
      RepairsPanel.svelte    # 维修待办
```
