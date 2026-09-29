# 本地运行约定

本目录目前只有运行约定和启动清单，没有业务实现。请根据用户需求创建应用，并实现清单中声明的入口；清单存在不代表服务已经实现。

macOS 本机运行，不升级运行时，不用 Docker、外部账号或收费 API；仅依赖安装可联网，演示离线。选择兼容 Node.js 24.15.x 的框架，只用 npm，提交 package-lock.json；根 npm install/npm ci 装齐 JS 依赖，提供 build/test。dev 接受对应框架示例参数，不启动清单外服务。提交根 run-local.json，不含私有路径或凭据。服务独立前台、绑定 127.0.0.1；占端口失败，不换端口或脱离父进程。启动者替换 {port}(自身端口)/{port:api}(API端口)；web 的 / 提供 HTML。npm test 单次运行，不进入监听模式。

## 启动清单

以下内容已保存在根目录 `run-local.json`。命令引用的文件、脚本、健康接口仍需随应用实现；不可把普通 HTML 当作 API 健康响应。

```json
{
  "version": 1,
  "runtimes": [
    "node"
  ],
  "web_service": "web",
  "services": [
    {
      "name": "web",
      "command": [
        "npm",
        "run",
        "dev",
        "--",
        "--hostname",
        "127.0.0.1",
        "--port",
        "{port}"
      ],
      "cwd": ".",
      "ready_path": "/",
      "env": {}
    }
  ]
}
```

业务说明、安装、测试和人工启动方式写入 README。不可把缓存、虚拟环境、node_modules 或运行数据提交到源码中。

