# 烘焙店预订出炉安排

小烘焙店的预订与出炉排产工具：维护商品配方、每日可用原料和烤箱时段，按取货日期接受预订，下单时校验原料与烤箱产能，取消订单自动释放占用，并生成每日制作清单。纯本地运行，不接支付、不用外部账号或收费服务。

## 技术栈

- 后端：Node.js + Express + TypeScript（`server/`），JSON 文件本地存储（默认 `server/data/bakery.json`，首次启动自动生成演示数据）
- 前端：React + TypeScript + Vite（`web/src/`），通过环境变量 `VITE_API_BASE_URL` 连接 API
- 共享领域类型：`shared/types.ts`；核心排产/校验逻辑：`server/domain.ts`（纯函数，可单测）

## 安装

```bash
npm install   # 或 npm ci
```

## 启动（开发）

```bash
# 终端 1：后端 API，接受 --host / --port 参数
npm run dev:api -- --host 127.0.0.1 --port 3001

# 终端 2：前端（通过 env 指向 API）
VITE_API_BASE_URL=http://127.0.0.1:3001 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开 http://127.0.0.1:5173 。健康检查：`curl http://127.0.0.1:3001/health` 返回 `{"status":"ok"}`。

也可以按根目录 `run-local.json` 的清单由启动器拉起两个服务。

## 构建与测试

```bash
npm run build   # 编译后端到 dist/server，类型检查前端，并打包前端到 dist/web
npm test        # vitest 单次运行：领域逻辑 + API 集成测试
npm start       # 运行构建后的后端（dist/server）
```

## 功能说明

- **预订下单**：选择取货日期、顾客与商品数量；提交时校验当日原料剩余与烤箱分钟剩余，不足则返回具体缺口（哪种原料差多少 / 烤箱差多少分钟），下单成功即占用。
- **订单状态**：待取货 / 已完成 / 已取消；取消后立即释放原料与烤箱占用。
- **每日制作清单**：按日期汇总每个商品的制作数量、炉数、烤箱分钟与原料合计。
- **配方与每日备货**：维护商品配方（每炉数量、烘烤分钟）、每日各原料可用量、每日烤箱时段。

## 数据与容量模型

- 配方定义 `batchSize`（每炉个数）与 `bakeMinutes`（每炉分钟）；订单占用烤箱时间 = ⌈数量 / 每炉个数⌉ × 每炉分钟。
- 原料按“每日库存 − 当日有效订单占用”计算剩余；烤箱按“当日时段总分钟 − 已占用分钟”计算剩余。
- 数据保存在本地 JSON 文件，可用环境变量 `DATA_FILE` 指定路径；测试使用内存存储，不写磁盘。

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{"status":"ok"}` |
| GET | `/api/recipes` / `/api/ingredients` | 配方与原料列表 |
| PUT | `/api/recipes/:id` | 更新配方（每炉数量、烘烤分钟等） |
| POST | `/api/stock` | 设置某日某原料可用量 |
| GET/POST/DELETE | `/api/oven-slots` | 查询 / 新增 / 删除烤箱时段 |
| GET | `/api/availability?date=` | 某日原料与烤箱剩余 |
| GET | `/api/production?date=` | 每日制作清单 |
| GET/POST | `/api/orders` | 查询 / 创建订单（不足时 409 并返回缺口） |
| POST | `/api/orders/:id/cancel` `/complete` | 取消（释放占用）/ 标记完成 |
