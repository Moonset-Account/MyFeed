# 客房清扫看板

面向小民宿的离线清扫协同看板。使用 FastAPI、SQLite 和原生 JavaScript 实现，不依赖外部账号、收费服务或前端构建工具。

## 功能

- 登记房间、楼层备注和房间检查项；新房间默认内置床品、卫生间、垃圾、通风等检查项。
- 登记退房时间和清扫人员。到达退房时间后，已排退房任务会在打开或刷新看板时自动转为待清扫；已预分配人员的任务转为已分配。
- 当日看板按“复查未通过返工 → 已超时 → 近期退房 → 今日稍后”的顺序展示任务。
- 清扫人员逐项勾选检查项，全部完成后才能提交复查。
- 复查未通过必须填写整改说明，房间回到返工队列；此时房间不是空房，不能标记为可入住。
- 复查通过后由前台确认，任务才进入“空房可入住”。
- 记录毛巾、浴巾、牙具、纸巾、瓶装水、垃圾袋等用品补充，并按日期查看。
- 每个房间保留任务状态流转、复查说明、用品补充等历史。

## 本地环境

- Python 3.11.x
- macOS 本机运行
- SQLite 数据库默认在项目根目录的 `cleaning.db`，首次启动自动建表并写入默认用品
- 不需要 Docker、npm 或外部服务

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

然后打开：

- 看板：`http://127.0.0.1:8000/`
- 健康检查：`http://127.0.0.1:8000/health`

`/health` 返回：

```json
{"status":"ok"}
```

根目录 `run-local.json` 已使用同一 FastAPI 进程提供页面和 API，启动命令、绑定地址和健康检查均与本说明一致。

## 运行测试

```bash
.venv/bin/python -m pytest
```

测试使用临时 SQLite 数据库，不会污染本地演示数据。

## 主要接口

- `GET /api/board?day=YYYY-MM-DD`：当日优先任务、已完成任务和用品记录
- `GET /api/rooms` / `POST /api/rooms`：房间列表与登记
- `GET /api/rooms/{room_id}/history`：房间任务和用品历史
- `POST /api/tasks`：登记退房任务
- `POST /api/tasks/{id}/assign`：分配清扫人员
- `POST /api/tasks/{id}/start`：开始清扫或返工
- `PATCH /api/tasks/{id}/items/{item_id}`：勾选检查项
- `POST /api/tasks/{id}/complete`：检查项全部完成后提交复查
- `POST /api/tasks/{id}/inspect`：复查通过或退回返工
- `POST /api/tasks/{id}/ready`：仅复查通过后可标记为空房可入住
- `GET /api/supplies?day=YYYY-MM-DD` / `POST /api/supplies`：用品补充记录

## 数据与演示

应用首次启动会创建 SQLite 表结构。运行产生的 `*.db`、缓存和虚拟环境均已在 `.gitignore` 中排除。演示时直接在页面登记房间、人员和退房任务即可。
