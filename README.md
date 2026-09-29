# 离线 OpenAPI 3.0 契约审查工具

这是一个本地运行的 FastAPI + React/TypeScript 应用，用于判断“新服务替换旧服务”时旧调用方会在哪里出问题。它按路径和 HTTP 方法对齐两份 OpenAPI 3.0 JSON，不接入外部账号、数据库或收费服务。

## 审查规则

请求和响应使用相反的兼容性方向：

- 请求：旧客户端按旧契约能发送的值和参数，新服务仍应接受。新增必填、枚举收窄、允许 null 变为不允许、基础类型收窄会判定为破坏。
- 响应：新服务仍应满足旧客户端依赖的保证。必填字段消失、枚举扩大、非 null 变成 nullable、基础类型改变会判定为破坏。
- 对象、数组、基础类型、`required`、`enum`、`nullable` 和文档内本地 `$ref` 会递归分析。
- `description`、`title`、示例、弃用标记等说明性变化不会产生结论。
- 外部引用、循环引用、`oneOf/anyOf/allOf`、格式、长度、范围、正则、`additionalProperties` 等范围外约束会列为“未知”，不会联网补全。局部未知不会吞掉其他已经确定的兼容或破坏差异。
- 每条结果包含两侧 JSON Pointer 位置、本地引用链、具体约束和原因；能构造时会给出一个仍满足旧契约但会被新服务拒绝的旧请求，或新服务可能返回但旧客户端无法保证处理的新响应。

## 安装

要求 Node.js 24.15.x 和 Python 3.11.x。首次安装在项目根目录运行：

```bash
npm install
```

该命令会安装 `package-lock.json` 中的前端依赖，并幂等创建 `.venv`、安装 `requirements.txt` 中固定的 Python 依赖。离线演示本身不访问网络；只有安装依赖需要联网。

## 本地开发

按 `run-local.json` 启动两个前台服务：

- API：`.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port <api-port>`
- Web：`VITE_API_BASE_URL=http://127.0.0.1:<api-port> npm run dev -- --host 127.0.0.1 --port <web-port> --strictPort`

如果手工启动，可先运行 API，例如端口 8000，再运行：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

浏览器打开 Vite 输出的本机地址。分别选择或粘贴旧、新 OpenAPI JSON 后点击“审查契约”。页面初始内置了一个回归示例；`examples/old.openapi.json` 与 `examples/new.openapi.json` 也保留了请求枚举收窄、响应枚举扩大、请求新增必填、响应失去必填保证和描述变化同时存在的情况。

## 测试和构建

```bash
npm test
npm run build
```

`npm test` 单次运行后端 pytest 回归测试。`npm run build` 会执行 TypeScript 检查、Vite 构建，并对 Python 后端做编译和导入检查。

健康检查：

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

## 目录结构

- `backend/contract.py`：离线契约比较和样例构造核心。
- `backend/app.py`：FastAPI 健康检查与审查接口。
- `src/`：React/TypeScript 页面。
- `tests/`：方向、引用、未知项不掩盖确定差异等回归测试。
- `examples/`：可直接在页面载入的新旧 OpenAPI JSON。
- `run-local.json`：本地启动清单。
