# 社区服务预约台

一个面向本地社区服务大厅的离线演示应用。FastAPI 提供页面和业务接口，SQLite 保存窗口配置与预约记录，前端使用原生 HTML/CSS/JavaScript，无需 npm 或外部账号。

## 功能

- 工作人员配置服务窗口、服务名称、单次服务时长、每日开放开始和结束时间。
- 系统按开放时间和服务时长自动生成每日可预约时段。
- 居民使用自定义匿名编号预约、查询、改期或取消，不采集姓名和手机号。
- SQLite 唯一索引阻止同一窗口、同一天、同一时段被重复占用。
- 工作人员查看当天叫号列表、剩余空档，并手动登记已到场、迟到、爽约状态。
- 迟到和爽约只保留状态记录，不产生积分、黑名单或自动惩罚。
- 已产生预约的窗口删除时会自动停用，保留完整预约历史。

## 本地环境

- Python 3.11.x
- FastAPI 0.115.6
- Uvicorn 0.34.0
- SQLite（Python 标准库）
- pytest 8.3.4

依赖版本固定在 `requirements.txt`。安装依赖需要联网；安装完成后的日常演示和测试可离线运行。

## 安装

在项目根目录执行：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

## 启动

```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

浏览器打开：

```text
http://127.0.0.1:8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

返回：

```json
{"status":"ok"}
```

根目录 `run-local.json` 已声明同一启动入口。服务只绑定 `127.0.0.1`，如果端口被占用会直接失败，不会自动换端口。

## 运行测试

```bash
.venv/bin/python -m pytest
```

测试覆盖窗口时段生成、重复占用阻止、改期释放原时段、取消恢复空档、迟到/爽约状态登记和有历史窗口的停用逻辑。

## 数据存储

默认数据库文件为：

```text
data/appointments.db
```

该目录已在 `.gitignore` 中排除，不会提交运行数据。也可以通过环境变量指定临时数据库：

```bash
APPOINTMENT_DB_PATH=/tmp/community-desk.db .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

## 主要接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/windows` | 查看启用窗口和时段 |
| `POST` | `/api/windows` | 新增窗口 |
| `PATCH` | `/api/windows/{id}` | 修改窗口配置 |
| `DELETE` | `/api/windows/{id}` | 删除无历史窗口；有历史时停用 |
| `POST` | `/api/appointments` | 居民预约 |
| `GET` | `/api/appointments/mine?resident_code=...` | 按匿名编号查询有效预约 |
| `POST` | `/api/appointments/{id}/reschedule` | 改期 |
| `POST` | `/api/appointments/{id}/cancel` | 取消预约 |
| `GET` | `/api/staff/day?date=YYYY-MM-DD` | 查看叫号列表和空档 |
| `PATCH` | `/api/staff/appointments/{id}/status` | 登记到场、迟到或爽约状态 |
