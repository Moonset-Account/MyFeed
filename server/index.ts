import { resolve } from 'node:path';
import { createApp } from './app.js';
import { OrderStore } from './store.js';

function parseArgs(argv: string[]): { host: string; port: number } {
  let host = '127.0.0.1';
  let port = 3001;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--host' && argv[i + 1]) {
      host = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--port' && argv[i + 1]) {
      const p = Number(argv[i + 1]);
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        console.error(`无效端口: ${argv[i + 1]}`);
        process.exit(1);
      }
      port = p;
      i += 1;
    }
  }
  return { host, port };
}

const { host, port } = parseArgs(process.argv.slice(2));
const dataFile = resolve(process.env.LAUNDRY_DATA_FILE ?? 'data/orders.json');
const store = new OrderStore(dataFile);
const app = createApp(store);

const server = app.listen(port, host, () => {
  console.log(`[api] 订单流转台后端已启动: http://${host}:${port} (数据文件: ${dataFile})`);
});

// 端口被占用等错误直接失败退出,不更换端口
server.on('error', (err) => {
  console.error(`[api] 启动失败: ${err.message}`);
  process.exit(1);
});
