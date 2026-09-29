# 社区服务预约台

一个本机离线演示用的社区服务预约系统：FastAPI 提供页面和 JSON API，SQLite 保存窗口、每日开放时段和预约记录，前端使用原生 HTML/CSS/JavaScript，不需要 npm、外部账号或收费服务。

## 功能

- 工作人员维护服务窗口、服务内容、单次服务时长，并可启用或停用窗口。
- 工作人员按日期配置每个窗口的开放开始和结束时间。
- 系统按窗口时长生成固定可约空档。
- 居民选择窗口、日期和空档后预约，系统返回 6 位匿名预约编号。
- 居民凭匿名编号查询、改期或取消；取消后空档立即释放。
- 同一窗口、同一天、同一固定时段不能重复占用；数据库事务和局部唯一索引会同时拦截并发重复提交。
- 工作人员可在当天叫号列表中登记“已叫号、迟到、爽约、已完成”等状态。
- 迟到和爽约只改变并保留预约状态，不会产生积分、封禁或其他自动惩罚。
- 当天看板按窗口展示叫号队列和剩余空档。

## 本机环境

- macOS
- Python 3.11.x
- 不使用 Docker，不使用 Node.js / npm
- SQLite 由 Python 标准库提供

## 安装

在项目根目录执行：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

依赖版本固定在 `requirements.txt`。只有安装依赖需要联网；安装完成后，应用运行和演示均访问本机服务与本地 SQLite 文件。

## 启动

根目录 `run-local.json` 已声明同一个 FastAPI 进程提供页面和 API。手动启动时执行：

```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

然后打开：

- 页面：<http://127.0.0.1:8000/>
- 健康检查：<http://127.0.0.1:8000/health>
- OpenAPI：<http://127.0.0.1:8000/docs>

`/health` 返回 `{"status":"ok"}`，不会回退为 HTML。服务绑定 `127.0.0.1`；如果端口已被占用，启动器会直接失败，不会自动换端口。

## 数据存储

默认数据库文件是项目根目录的 `appointments.db`，首次启动自动建表。该文件和所有 `*.db` 已在 `.gitignore` 中忽略，不随源码提交。

测试可通过环境变量使用独立数据库：

```bash
APPOINTMENT_DB=/tmp/appointment-desk-test.db .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

## 快速演示流程

1. 打开页面，进入“窗口配置”。
2. 新增窗口，例如“一号窗口 / 社保咨询 / 20 分钟”。
3. 在右侧选择窗口、日期、开放开始和结束时间，保存每日时段。
4. 回到“居民预约”，选择同一窗口和日期，点击绿色空档后提交。
5. 保存系统返回的 6 位匿名编号。
6. 在右侧输入编号，可以查询、改期或取消。
7. 进入“当天叫号”，查看队列和空档，并用“叫号、迟到、爽约、完成”登记状态。

## 运行测试

```bash
.venv/bin/python -m pytest
```

测试覆盖健康检查、匿名预约、重复占用拦截、改期、取消释放空档、迟到/爽约状态、当天队列与空档计算。

## 主要接口

- `GET /api/windows`：窗口列表
- `POST /api/windows`：新增窗口
- `PATCH /api/windows/{window_id}`：更新窗口或停用
- `GET /api/schedules`：每日时段列表
- `POST /api/schedules`：配置每日时段
- `PUT /api/schedules/{schedule_id}`：修改开放时间
- `DELETE /api/schedules/{schedule_id}`：删除没有有效预约的时段
- `GET /api/availability?window_id=1&schedule_date=2026-10-01`：查询固定空档
- `POST /api/appointments`：匿名预约
- `GET /api/appointments/lookup/{reference}`：居民凭编号查询
- `POST /api/appointments/lookup/{reference}/reschedule`：改期
- `POST /api/appointments/lookup/{reference}/cancel`：取消
- `GET /api/dashboard?schedule_date=2026-10-01`：当天叫号列表与空档
