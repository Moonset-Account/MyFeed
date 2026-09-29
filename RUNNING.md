# 本地运行约定

本目录目前只有运行约定和启动清单，没有业务实现。请根据用户需求创建应用，并实现清单中声明的入口；清单存在不代表服务已经实现。

macOS 本机，不升级、不用 Docker/外部账号/收费 API；仅安装依赖联网，演示离线。Node.js 24.15.x/Python 3.11.x 兼容依赖，只用 npm、提交 package-lock.json。根 npm install/npm ci 装齐 JS 依赖且幂等建立 .venv、安装固定版本 requirements.txt（含 pytest）；{venv_python}=.venv/bin/python。build/test 覆盖两端，build 含 Python 导入/语法检查；dev 仅 web。API 地址读清单 env；用开发代理或仅允许本机源的 CORS，验证真实请求。/health 返回 ready_json 指定 JSON。根提交 run-local.json，无私有路径/凭据；服务独立前台监听 127.0.0.1，端口忙失败，不换端口或脱离父进程。启动者替换 {port}(自身)/{port:api}(API)端口；web / 提供 HTML。npm test 单次运行，不进入监听模式。

## 启动清单

以下内容已保存在根目录 `run-local.json`。命令引用的文件、脚本、健康接口仍需随应用实现；不可把普通 HTML 当作 API 健康响应。

```json
{
  "version": 1,
  "runtimes": [
    "node",
    "python"
  ],
  "web_service": "web",
  "services": [
    {
      "name": "api",
      "command": [
        "{venv_python}",
        "-m",
        "uvicorn",
        "backend.app:app",
        "--host",
        "127.0.0.1",
        "--port",
        "{port}"
      ],
      "cwd": ".",
      "ready_path": "/health",
      "env": {},
      "ready_json": {
        "status": "ok"
      }
    },
    {
      "name": "web",
      "command": [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "{port}",
        "--strictPort"
      ],
      "cwd": ".",
      "ready_path": "/",
      "env": {
        "VITE_API_BASE_URL": "http://127.0.0.1:{port:api}"
      }
    }
  ]
}
```

业务说明、安装、测试和人工启动方式写入 README。不可把缓存、虚拟环境、node_modules 或运行数据提交到源码中。

