# 洗衣店订单流转台

社区洗衣店的订单管理应用:接单时录入衣物件数、服务项目、约定取件日期和特殊污渍备注,订单依次流转 **清洗 → 质检 → 待领取 → 已取件**;质检不通过可退回重洗并留痕。支持逾期取件筛选、金额汇总和本机 JSON 文件持久化,完全离线可用。

## 技术栈

- 后端:Node.js + Express + TypeScript(`server/`)
- 前端:Vue 3 + Vite + TypeScript(`web/`)
- 共享领域逻辑:`shared/domain.ts`(状态机、价目表、金额与逾期计算,前后端复用)
- 持久化:本机 JSON 文件 `data/orders.json`(原子写入,已 gitignore,可用环境变量 `LAUNDRY_DATA_FILE` 改路径)

## 安装

```bash
npm install   # 或 npm ci
```

## 启动(两个前台进程)

```bash
# 终端 1:后端 API,默认 127.0.0.1:3001
npm run dev:api -- --host 127.0.0.1 --port 3001

# 终端 2:前端,通过 VITE_API_BASE_URL 指向后端
VITE_API_BASE_URL=http://127.0.0.1:3001 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开 http://127.0.0.1:5173 即可使用。未设置 `VITE_API_BASE_URL` 时,前端通过 Vite 开发代理访问 `127.0.0.1:3001`。

健康检查:`GET /health` 返回 `{"status":"ok"}`。

## 测试与构建

```bash
npm test    # vitest 单次运行:领域逻辑 + API 全流程(含退回留痕、逾期筛选、汇总、持久化)
npm run build   # 后端 tsc 编译 + 前端 vue-tsc 类型检查 + vite 产物
```

## 业务规则

- 金额 = 所选服务项目单价之和 × 衣物件数,由服务端计算(价目表见 `shared/domain.ts`)。
- 流转动作:`finish_wash`(清洗完成送质检)、`pass_qc`(质检通过待领取)、`fail_qc`(退回重洗,**必须填写原因**)、`pickup`(顾客取件);每次流转写入 `history` 留痕。
- 逾期:超过约定取件日期且未取走的订单;列表支持 `?overdue=1` 筛选,前端有"仅看逾期未取"开关。
- 汇总:`GET /api/summary` 返回各状态单数、在途/待领取/已回款金额及逾期单数与金额。

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/api/services` | 服务项目价目表 |
| GET | `/api/orders?status=&overdue=1&q=` | 订单列表(状态/逾期/关键字筛选) |
| POST | `/api/orders` | 接单 |
| POST | `/api/orders/:id/transitions` | 状态流转 `{action, note?}` |
| GET | `/api/summary` | 金额与单数汇总 |
