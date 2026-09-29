# 采收追溯表

这是一个面向果园本地演示的采收批次登记与箱号追溯应用。后端使用 Python FastAPI 和 SQLite，前端使用原生 HTML、CSS、JavaScript，不依赖 npm、外部账号或收费服务。

## 功能

- 登记地块、品种、采收日期、采收重量和分装箱号。
- 同一箱号只能归属一个批次，重复箱号会被拒绝。
- 一个批次内的分装总重不能超过采收重量。
- 自动计算批次剩余库存（采收重量 - 已分装重量）。
- 按箱号查询来源地块、品种、采收日期、单箱重量和批次剩余库存。
- 导出全部批次或指定箱号的 CSV。
- 数据保存在本地 SQLite 文件 `harvest.db`，首次启动时自动创建。

## 本机环境

- Python 3.11.x
- macOS / Linux 本地终端
- 不需要 Docker、Node.js 或外部数据库

在项目根目录执行：

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

## 运行测试

```bash
.venv/bin/python -m pytest
```

## 启动应用

```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

启动后访问：

- 页面：<http://127.0.0.1:8000/>
- 健康检查：<http://127.0.0.1:8000/health>
- CSV 导出：<http://127.0.0.1:8000/api/export.csv>

健康检查必须返回 JSON：

```json
{"status":"ok"}
```

## 使用 run-local.json

根目录的 `run-local.json` 已声明本地启动清单。启动器会把 `{venv_python}` 替换为 `.venv/bin/python`，把 `{port}` 替换为分配给本服务的本机端口。Uvicorn 绑定 `127.0.0.1`，端口被占用时直接失败，不会自动换端口。

## 数据与重量规则

SQLite 表结构在应用启动时自动初始化。为避免浮点误差，接口以千克为单位接收重量，数据库内部按克级整数存储，千克最多保留 3 位小数。

业务接口包括：

- `POST /api/batches`：登记批次和箱号。
- `GET /api/batches`：查看全部批次。
- `GET /api/boxes?code=A-001`：按箱号查询来源和剩余库存。
- `GET /api/export.csv`：导出全部 CSV。
- `GET /api/export.csv?box_code=A-001`：导出指定箱号 CSV。
