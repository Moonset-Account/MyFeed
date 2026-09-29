# 烘焙店预订出炉安排

小烘焙店的本地预订管理系统：维护商品配方、每日可用原料和烤箱时段，按取货日期与数量接预订；下单时自动检查原料与产能并占用，取消后释放；提供每日制作清单与订单状态管理。不接支付，数据保存在本地 JSON 文件中，可离线演示。

技术栈：Node.js + Express + React + TypeScript（Vite）。

## 环境要求

- Node.js 24.15.x（兼容 24.x）
- 仅使用 npm

## 安装

```bash
npm install   # 或 npm ci
```

## 启动（开发）

后端 API（默认 127.0.0.1:3001，可用 `--host` / `--port` 覆盖）：

```bash
npm run dev:api -- --host 127.0.0.1 --port 3001
```

前端（另开一个终端，通过 `VITE_API_BASE_URL` 指向 API）：

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001 npm run dev
```

也可以按根目录 `run-local.json` 清单由启动器拉起两个服务。健康检查：`GET /health` 返回 `{"status":"ok"}`。

## 测试与构建

```bash
npm test      # vitest 单次运行：核心领域逻辑 + 前端组件/工具测试
npm run build # 后端 tsc 类型检查 + 前端 vite 构建
```

## 功能说明

- **预订下单**：填写取货人、取货日期和各商品数量。下单时校验：
  - 原料：按配方 × 数量汇总，与该日剩余库存比较，不足则拒绝并列出缺口；
  - 产能：按商品「每炉数量」向上取整换算炉数，贪心分配到当日烤箱时段，产能不足则拒绝。
- **订单管理**：查看全部订单及状态（待取货 / 已完成 / 已取消），可标记取货完成或取消；取消后原料与烤箱占用立即释放。
- **每日制作清单**：按日期汇总各商品需制作数量、炉数和原料用量。
- **原料与烤箱**：查看某日各原料的可用 / 已占用 / 剩余量，以及各烤箱时段的容量占用。

## 数据存储

首次启动自动生成演示数据（4 种商品配方、未来 7 天原料库存与每日 3 个烤箱时段），写入 `data/store.json`；之后每次订单变更都会落盘。该文件为运行数据，已被 `.gitignore` 排除。可用环境变量 `BAKERY_DATA_FILE` 指定其他路径。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/api/bootstrap` | 商品与原料基础数据 |
| GET | `/api/availability?date=YYYY-MM-DD` | 当日原料与烤箱剩余 |
| GET | `/api/production?date=YYYY-MM-DD` | 当日制作清单 |
| GET | `/api/orders` | 订单列表 |
| POST | `/api/orders` | 创建订单（冲突返回 409 及缺口明细） |
| POST | `/api/orders/:id/cancel` | 取消订单，释放占用 |
| POST | `/api/orders/:id/complete` | 标记取货完成 |

## 目录结构

```
server/    Express API 与领域逻辑（domain.ts 为核心，store.ts 为本地存储与种子数据）
shared/    前后端共享的 TypeScript 类型
src/       React 前端（components/ 为四个页面，lib/ 为格式化工具）
```
