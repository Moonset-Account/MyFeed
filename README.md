# 盘点差异助手

面向小店的离线盘点工具：导入商品清单后逐项录入实盘数量，按货架与类别查看账实差异，登记差异原因并生成复盘表。重复扫码/录入同一商品时不会悄悄覆盖已录数量，必须显式确认。支持 CSV 导入导出，内置一份可直接试用的样例清单，不连接任何外部库存系统。

技术栈：FastAPI（后端与页面同一进程）+ 原生 JavaScript（无构建步骤）。数据保存在内存中，通过 CSV 导入导出交换，重启后需重新导入。

## 环境准备

需要 Python 3.11.x（不升级本机运行时，无需 Docker、npm 或外部账号）。

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

仅安装依赖时需要联网；安装完成后演示可完全离线。

## 启动

```bash
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

浏览器打开 <http://127.0.0.1:8000> 。健康检查接口 `GET /health` 返回 `{"status": "ok"}`。服务在前台运行、仅绑定本机回环地址；端口被占用时命令会直接失败，请换一个空闲端口重新启动。

## 使用流程

1. **商品清单**：点击「载入内置样例」立即试用，或上传自己的 CSV（UTF-8，表头为 `sku,name,category,shelf,book_qty`，可点击「下载样例 CSV」参考格式）。导入即开启新一轮盘点并清空旧数据。
2. **盘点录入**：扫描枪或手工输入 SKU 回车，再输入实盘数量回车提交。同一商品再次录入时，页面会提示已录数量并询问是否覆盖，只有点「确认覆盖」才会改写；也可以对单条记录「撤销」。
3. **差异查看**：按货架、类别筛选，查看两个维度的汇总（账面合计/实盘合计/差异合计）与明细；点击明细行登记差异原因（正常损耗、破损报废、丢失、进货未入账、销售未入账、盘点错误、其他）和备注。
4. **复盘表**：列出全部差异项及原因，未登记原因的行会高亮提示；可导出复盘表 CSV 或全部盘点结果 CSV（带 BOM，Excel 可直接打开）。

## 运行测试

```bash
.venv/bin/python -m pytest -q
```

测试覆盖：CSV 导入校验、重复录入防覆盖与确认覆盖、差异按货架/类别汇总、差异原因与复盘表、CSV 导出等核心逻辑。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{"status": "ok"}` |
| POST | `/api/import` | 上传商品清单 CSV（multipart 字段 `file`），开启新一轮盘点 |
| POST | `/api/sample` | 载入内置样例清单 |
| GET | `/api/items` | 商品清单与盘点进度汇总 |
| POST | `/api/count` | 录入实盘数量；已录入时返回 409，`confirm_overwrite: true` 才覆盖 |
| DELETE | `/api/count/{sku}` | 撤销某商品的录入 |
| POST | `/api/reason` | 登记差异原因与备注 |
| GET | `/api/differences` | 差异明细及按货架、类别汇总（支持 `shelf`、`category` 过滤） |
| GET | `/api/review` | 复盘表数据 |
| GET | `/api/export/counts.csv`、`/api/export/review.csv` | 导出 CSV |
| POST | `/api/reset` | 清空全部数据 |

## 目录结构

```
app.py               FastAPI 应用（页面、接口、内存数据存储）
static/index.html    单页面前端
static/app.js        原生 JavaScript 交互逻辑
static/style.css     样式
sample_products.csv  可直接试用的样例商品清单
tests/test_app.py    核心逻辑测试
requirements.txt     固定版本依赖
run-local.json       本地启动清单
```
