# 采收追溯表

果园采收批次追溯应用：FastAPI 提供页面与业务接口，原生 JavaScript 单页操作，本地 SQLite 存储，离线可用。

## 功能

- 登记采收批次：地块、品种、采收日期、采收重量
- 登记分装箱号：同一箱号只能归属一个批次；同一批次的分装总重不能超过采收量
- 按箱号查询来源（批次、地块、品种、采收日期）与批次剩余库存（采收量 − 已分装重量）
- 一键导出全部分装记录的 CSV（UTF-8 带 BOM，Excel 可直接打开）

## 环境准备

需要 Python 3.11.x，不安装全局依赖：

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 启动

```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

浏览器打开 <http://127.0.0.1:8000/> 使用页面；健康检查接口为 `GET /health`，返回 `{"status": "ok"}`。

数据保存在项目目录下的 `harvest.db`（SQLite，已加入 .gitignore，不提交）。可用环境变量 `HARVEST_DB` 指定其他数据库路径。

## 测试

```bash
.venv/bin/python -m pytest
```

测试覆盖：批次登记与校验、箱号跨批次唯一、分装总重不超采收量、箱号溯源、CSV 导出。

## 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{"status": "ok"}` |
| GET | `/` | 单页应用 |
| POST | `/api/batches` | 登记采收批次 |
| GET | `/api/batches` | 批次列表（含已分装、剩余库存） |
| POST | `/api/batches/{id}/boxes` | 为批次分装箱号 |
| GET | `/api/boxes/{box_no}` | 按箱号溯源 |
| GET | `/api/export.csv` | 导出 CSV |
