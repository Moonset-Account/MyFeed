# 离线 OpenAPI 3.0 契约审查工具

这个工具用于在“新服务替换旧服务”之前定位旧调用方会受到的影响。它按路径和 HTTP 方法对齐两份 OpenAPI 3.0 JSON，不联网解析外部 schema，也不依赖外部账号或付费服务。

## 能判断的契约

当前实现覆盖：

- 参数：参数新增、参数变为必填、参数 schema 的基础类型和枚举变化。
- 请求体：JSON media type、对象字段、数组元素、基础类型、`required`、`enum`、`nullable`、本地 `$ref`。
- 响应：状态码、JSON media type、必填响应头、响应对象字段、数组元素、基础类型、`required`、`enum`、`nullable`、本地 `$ref`。
- 引用：支持文档内本地 `$ref`，结果中展示解析后的 JSON Pointer 和完整引用链。
- 未知：外部 `$ref`、损坏本地引用、循环引用、`format`、数值/字符串范围、组合 schema、序列化方式、非 JSON media type 等不做猜测。

请求和响应使用相反的兼容性方向：

- 请求侧：新增必填参数或字段、收窄枚举、去掉 nullable、旧值无法满足新类型，都是破坏。
- 响应侧：去掉原有必填保证、扩大枚举、新增 nullable 输出、新响应值无法满足旧客户端类型，都是破坏。
- `description`、`title`、示例文案等说明变化不会产生结论；每个结论都落到具体约束，例如 `enum value "cancelled"` 或 `response body id required: true -> false`。
- 某个字段存在外部引用或范围外约束时，只把该局部标为未知；同一操作中的确定破坏和兼容差异仍会分别列出。

当差异可以构造证据时，结果会给出：

- 会被新服务拒绝的旧请求，例如旧枚举值、旧请求未发送新增必填字段。
- 会让旧客户端失配的新响应，例如扩大后的枚举值、缺失旧必填字段的响应。

界面默认载入一份回归样例，同时覆盖请求枚举收窄和响应枚举扩大，避免以后把两个方向错误地套成同一条规则。

## 目录结构

- `backend/`：FastAPI 应用和契约比较核心逻辑。
- `frontend/`：React + TypeScript + Vite 界面。
- `tests/`：pytest 核心逻辑和 HTTP API 测试。
- `run-local.json`：本地启动清单，API 健康检查为 `GET /health` 返回 `{ "status": "ok" }`。

## 安装

要求：

- Node.js 24.15.x
- Python 3.11.x
- npm

在项目根目录运行：

```bash
npm install
```

`postinstall` 会创建或复用 `.venv`，并安装 `requirements.txt` 中固定的 Python 依赖。若本机全局 npm cache 有权限问题，可把 cache 指到临时目录，不需要修改用户目录：

```bash
npm install --cache /private/tmp/openapi-contract-npm-cache
```

## 一键测试和构建

```bash
npm test
```

该命令依次执行：

1. TypeScript 类型检查。
2. Vite 生产构建。
3. Python 编译和后端导入检查。
4. pytest 核心逻辑与 API 测试。

## 本地启动

推荐使用支持 `run-local.json` 的本地演示启动器。启动器会在前台、独立进程中监听 `127.0.0.1`，端口忙时失败，不自动换端口。

手动启动时开两个终端。

API：

```bash
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Web：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

打开：

```text
http://127.0.0.1:5173/
```

前端通过 Vite 开发代理访问 `/api/compare`；`VITE_API_BASE_URL` 指向启动清单分配的 API 地址。健康检查：

```bash
curl http://127.0.0.1:8000/health
```

应返回：

```json
{"status":"ok"}
```

## HTTP API

`POST /api/compare`

请求体：

```json
{
  "old": { "openapi": "3.0.3", "paths": {} },
  "new": { "openapi": "3.0.3", "paths": {} }
}
```

返回按操作聚合的报告，每个 finding 包含严重级别、请求/响应方向、原因、双侧位置、引用链、具体约束和失败示例。严重级别为：

- `compatible`：兼容变化。
- `breaking`：可确定的破坏。
- `unknown`：本地信息不足或约束在当前范围之外。

## 离线和数据边界

所有分析都在浏览器和本机 FastAPI 中完成。外部 `$ref` 不会被请求，循环 schema 不会被无限展开。仓库不包含数据库文件、用户媒体、凭据、缓存、依赖目录或本机绝对路径。
