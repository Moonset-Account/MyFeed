# 本地运行约定

本目录目前只有运行约定和启动清单，没有业务实现。请根据用户需求创建应用，并实现清单中声明的入口；清单存在不代表服务已经实现。

macOS 本机运行，不升级运行时，不用 Docker、外部账号或收费 API；仅依赖安装可联网，演示离线。Node.js 24.15.x 兼容框架，只用 npm 并提交 package-lock.json；根 npm install/npm ci 装全 JS 依赖。Go 1.20.2 标准库后端，go.mod 用 go 1.20；不用高版本 API/toolchain 或自动下载工具链。build/test 覆盖两端，dev 仅 web。实现示例入口及参数，api 独立启动。前端按清单 env 动态连接 API，用开发代理或仅本机源 CORS，验证真实请求；/health 按 ready_json 返回 JSON 而非 HTML。提交根 run-local.json，不含私有路径或凭据。服务独立前台、绑定 127.0.0.1；占端口失败，不换端口或脱离父进程。启动者替换 {port}(自身端口)/{port:api}(API端口)；web 的 / 提供 HTML。npm test 单次运行，不进入监听模式。

## 启动清单

以下内容已保存在根目录 `run-local.json`。命令引用的文件、脚本、健康接口仍需随应用实现；不可把普通 HTML 当作 API 健康响应。

```json
{
  "version": 1,
  "runtimes": [
    "node",
    "go"
  ],
  "web_service": "web",
  "services": [
    {
      "name": "api",
      "command": [
        "go",
        "run",
        "./backend",
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

